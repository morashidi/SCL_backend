const assert = require("assert");
const request = require("supertest");
const User = require("../src/models/user.model");
const {
    app,
    seedUser,
    seedAndLogin,
    authHeader,
} = require("./helpers");

describe("User routes", () => {
    const password = "Secret123!";

    describe("POST /api/users", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app)
                .post("/api/users")
                .send({
                    name: "Call Center",
                    username: "agent1",
                    password,
                    role: "call_center",
                });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 400 when required fields are missing", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Call Center",
                    username: "agent1",
                });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(
                res.body.message,
                "Name, username, password and role are required",
            );
        });

        it("returns 409 when the username already exists", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await seedUser({
                name: "Existing Agent",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "New Agent",
                    username: "AGENT1",
                    password,
                    role: "call_center",
                });

            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.message, "Username already exists");
        });

        it("lets an admin create a call center account", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Call Center",
                    username: "Agent1",
                    password,
                    role: "call_center",
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.message, "User created successfully");
            assert.strictEqual(res.body.user.name, "Call Center");
            assert.strictEqual(res.body.user.username, "agent1");
            assert.strictEqual(res.body.user.role, "call_center");
            assert.strictEqual(res.body.user.password, undefined);

            const created = await User.findOne({ username: "agent1" });
            assert.ok(created);
            assert.notStrictEqual(created.password, password);
        });

        it("does not let an admin create a non call-center account", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Delivery",
                    username: "driver1",
                    password,
                    role: "mandoob",
                });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "Admin can only create call center accounts",
            );
        });

        it("lets a call center create a delivery man account", async () => {
            const { token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Delivery",
                    username: "driver1",
                    password,
                    role: "mandoob",
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.message, "User created successfully");
            assert.strictEqual(res.body.user.role, "mandoob");
            assert.strictEqual(res.body.user.username, "driver1");
        });

        it("does not let a call center create a non delivery-man account", async () => {
            const { token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Admin Two",
                    username: "admin2",
                    password,
                    role: "admin",
                });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "Call center can only create delivery man accounts",
            );
        });

        it("does not let a delivery man create users", async () => {
            const { token } = await seedAndLogin({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const res = await request(app)
                .post("/api/users")
                .set(authHeader(token))
                .send({
                    name: "Someone",
                    username: "someone",
                    password,
                    role: "call_center",
                });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "You are not allowed to create users",
            );
        });
    });
});
