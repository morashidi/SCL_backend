const assert = require("assert");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const Token = require("../src/models/token.model");
const {
    app,
    seedUser,
    login,
    seedAndLogin,
    authHeader,
    issueStoredToken,
} = require("./helpers");

describe("Auth routes", () => {
    const password = "Secret123!";
    const credentials = {
        username: "admin",
        password,
    };

    describe("POST /api/auth/login", () => {
        beforeEach(async () => {
            await seedUser({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });
        });

        it("returns 400 when username is missing", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({ password });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(
                res.body.message,
                "Username and password are required",
            );
        });

        it("returns 400 when password is missing", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({ username: "admin" });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(
                res.body.message,
                "Username and password are required",
            );
        });

        it("returns 401 when the username does not exist", async () => {
            const res = await login({
                username: "unknown",
                password,
            });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Invalid username or password");
        });

        it("returns 401 when the password is wrong", async () => {
            const res = await login({
                username: "admin",
                password: "wrong-password",
            });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Invalid username or password");
        });

        it("logs in with a case-insensitive username", async () => {
            const res = await login({
                username: "ADMIN",
                password,
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, "Login successful");
            assert.strictEqual(res.body.user.username, "admin");
        });

        it("returns 401 when the user is deleted", async () => {
            await User.updateOne(
                { username: "admin" },
                { status: "deleted" },
            );

            const res = await login(credentials);

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Invalid username or password");
        });

        it("returns a token and public user fields on success", async () => {
            const res = await login(credentials);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, "Login successful");
            assert.ok(res.body.token);
            assert.strictEqual(res.body.user.name, "Admin User");
            assert.strictEqual(res.body.user.username, "admin");
            assert.strictEqual(res.body.user.role, "admin");
            assert.strictEqual(res.body.user.password, undefined);

            const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
            assert.strictEqual(decoded.role, "admin");
            assert.ok(decoded.userId);

            const storedToken = await Token.findOne({ token: res.body.token });
            assert.ok(storedToken);
            assert.strictEqual(storedToken.status, "active");
            assert.strictEqual(
                String(storedToken.userId),
                String(res.body.user.id),
            );
        });
    });

    describe("GET /api/auth/me", () => {
        it("returns 401 when no authorization header is sent", async () => {
            const res = await request(app).get("/api/auth/me");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 401 when the authorization scheme is not Bearer", async () => {
            const res = await request(app)
                .get("/api/auth/me")
                .set("Authorization", "Token abc");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("returns 401 when the JWT is malformed", async () => {
            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader("not-a-jwt"));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(
                res.body.message,
                "Invalid or expired access token",
            );
        });

        it("returns 401 when the JWT is expired", async () => {
            const { user } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const expiredToken = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" },
            );

            await Token.create({
                token: expiredToken,
                userId: user._id,
                status: "active",
            });

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(expiredToken));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(
                res.body.message,
                "Invalid or expired access token",
            );
        });

        it("returns 401 when the token is not stored as active", async () => {
            const user = await seedUser({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const token = await issueStoredToken(user, { status: "inactive" });

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(
                res.body.message,
                "Invalid or expired access token",
            );
        });

        it("returns 401 when the token was never stored", async () => {
            const user = await seedUser({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const token = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: "7d" },
            );

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(
                res.body.message,
                "Invalid or expired access token",
            );
        });

        it("returns 401 when the user no longer exists", async () => {
            const missingUserId = new mongoose.Types.ObjectId();
            const token = jwt.sign(
                { userId: missingUserId, role: "admin" },
                process.env.JWT_SECRET,
                { expiresIn: "7d" },
            );

            await Token.create({
                token,
                userId: missingUserId,
                status: "active",
            });

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "User not found");
        });

        it("returns 401 when the stored role no longer matches the token", async () => {
            const { user, token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            await User.updateOne({ _id: user._id }, { role: "recruiter" });

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Unauthorized");
        });

        it("returns the current user without a password", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.user.name, "Admin User");
            assert.strictEqual(res.body.user.username, "admin");
            assert.strictEqual(res.body.user.role, "admin");
            assert.strictEqual(res.body.user.password, undefined);
        });
    });

    describe("POST /api/auth/logout", () => {
        it("returns 401 when no access token is sent", async () => {
            const res = await request(app).post("/api/auth/logout");

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.message, "Access token is required");
        });

        it("marks the current token inactive and rejects later requests", async () => {
            const { token } = await seedAndLogin({
                name: "Admin User",
                username: "admin",
                password,
                role: "admin",
            });

            const res = await request(app)
                .post("/api/auth/logout")
                .set(authHeader(token));

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.message, "Logout successful");

            const storedToken = await Token.findOne({ token });
            assert.strictEqual(storedToken.status, "inactive");

            const meRes = await request(app)
                .get("/api/auth/me")
                .set(authHeader(token));

            assert.strictEqual(meRes.status, 401);
            assert.strictEqual(
                meRes.body.message,
                "Invalid or expired access token",
            );
        });
    });
});
