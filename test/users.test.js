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

    describe("GET /api/users", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app).get("/api/users");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns a paginated list of users without passwords", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });
            await seedUser({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const res = await request(app)
                .get("/api/users")
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.page, 1);
            assert.strictEqual(res.body.pageSize, 20);
            assert.strictEqual(res.body.total, 3);
            assert.strictEqual(res.body.items.length, 3);
            assert.ok(res.body.items.every((user) => user.password === undefined));
            assert.ok(res.body.items.every((user) => user.id && user.name && user.username && user.role));
        });

        it("filters users by role", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });
            await seedUser({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const res = await request(app)
                .get("/api/users")
                .query({ role: "call_center" })
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.total, 1);
            assert.strictEqual(res.body.items.length, 1);
            assert.strictEqual(res.body.items[0].username, "agent1");
            assert.strictEqual(res.body.items[0].role, "call_center");
        });

        it("searches users by name or username", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await seedUser({
                name: "Ahmed Agent",
                username: "agent1",
                password,
                role: "call_center",
            });
            await seedUser({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const res = await request(app)
                .get("/api/users")
                .query({ search: "ahmed" })
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.total, 1);
            assert.strictEqual(res.body.items[0].username, "agent1");
        });

        it("respects page and pageSize query params", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });
            await seedUser({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const firstPage = await request(app)
                .get("/api/users")
                .query({ page: 1, pageSize: 2 })
                .set(authHeader(token));

            assert.strictEqual(firstPage.status, 200);
            assert.strictEqual(firstPage.body.page, 1);
            assert.strictEqual(firstPage.body.pageSize, 2);
            assert.strictEqual(firstPage.body.total, 3);
            assert.strictEqual(firstPage.body.items.length, 2);

            const secondPage = await request(app)
                .get("/api/users")
                .query({ page: 2, pageSize: 2 })
                .set(authHeader(token));

            assert.strictEqual(secondPage.status, 200);
            assert.strictEqual(secondPage.body.page, 2);
            assert.strictEqual(secondPage.body.items.length, 1);
        });
    });

    describe("GET /api/users/:userId", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app).get("/api/users/123");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 404 when the user does not exist", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .get("/api/users/64b000000000000000000001")
                .set(authHeader(token));

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.message, "User not found");
        });

        it("returns a user without a password", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const target = await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.user.name, "Call Center");
            assert.strictEqual(res.body.user.username, "agent1");
            assert.strictEqual(res.body.user.role, "call_center");
            assert.strictEqual(res.body.user.password, undefined);
            assert.strictEqual(String(res.body.user.id), String(target._id));
        });
    });

    describe("PATCH /api/users/:userId", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app)
                .patch("/api/users/123")
                .send({ name: "Updated" });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 404 when the user does not exist", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .patch("/api/users/64b000000000000000000001")
                .set(authHeader(token))
                .send({ name: "Updated" });

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.message, "User not found");
        });

        it("does not let a delivery man update other users", async () => {
            const { token } = await seedAndLogin({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const target = await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .patch(`/api/users/${target._id}`)
                .set(authHeader(token))
                .send({ name: "Updated" });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "You are not allowed to update this user",
            );
        });

        it("does not let a call center update an admin", async () => {
            const admin = await seedUser({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const { token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .patch(`/api/users/${admin._id}`)
                .set(authHeader(token))
                .send({ name: "Updated" });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "You are not allowed to update this user",
            );
        });

        it("lets an admin update a call center account", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const target = await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .patch(`/api/users/${target._id}`)
                .set(authHeader(token))
                .send({ name: "Updated Agent" });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, "User updated successfully");
            assert.strictEqual(res.body.user.name, "Updated Agent");
            assert.strictEqual(res.body.user.username, "agent1");
            assert.strictEqual(res.body.user.password, undefined);
        });

        it("lets a user update their own password", async () => {
            const { user, token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .patch(`/api/users/${user._id}`)
                .set(authHeader(token))
                .send({ password: "NewSecret123!" });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, "User updated successfully");

            const updated = await User.findById(user._id);
            assert.notStrictEqual(updated.password, "NewSecret123!");
        });
    });

    describe("DELETE /api/users/:userId", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app).delete("/api/users/123");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 404 when the user does not exist", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .delete("/api/users/64b000000000000000000001")
                .set(authHeader(token));

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.message, "User not found");
        });

        it("does not let a delivery man delete users", async () => {
            const { token } = await seedAndLogin({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const target = await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .delete(`/api/users/${target._id}`)
                .set(authHeader(token));

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "You are not allowed to delete this user",
            );
        });

        it("does not let a call center delete an admin", async () => {
            const admin = await seedUser({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const { token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .delete(`/api/users/${admin._id}`)
                .set(authHeader(token));

            assert.strictEqual(res.status, 403);
            assert.strictEqual(
                res.body.message,
                "You are not allowed to delete this user",
            );
        });

        it("lets an admin delete a call center account", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const target = await seedUser({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const res = await request(app)
                .delete(`/api/users/${target._id}`)
                .set(authHeader(token));

            assert.strictEqual(res.status, 204);

            const deleted = await User.findById(target._id);
            assert.strictEqual(deleted, null);
        });

        it("lets a call center delete a delivery man account", async () => {
            const { token } = await seedAndLogin({
                name: "Call Center",
                username: "agent1",
                password,
                role: "call_center",
            });

            const target = await seedUser({
                name: "Delivery",
                username: "driver1",
                password,
                role: "mandoob",
            });

            const res = await request(app)
                .delete(`/api/users/${target._id}`)
                .set(authHeader(token));

            assert.strictEqual(res.status, 204);

            const deleted = await User.findById(target._id);
            assert.strictEqual(deleted, null);
        });
    });
});
