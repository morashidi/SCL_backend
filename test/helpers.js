const bcrypt = require("bcryptjs");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user.model");
const Token = require("../src/models/token.model");
const app = require("../src/app");

async function seedUser({
    name = "Test User",
    username,
    password,
    role,
}) {
    const hashedPassword = await bcrypt.hash(password, 10);

    return User.create({
        name,
        username: username.toLowerCase(),
        password: hashedPassword,
        role,
    });
}

async function login(credentials) {
    return request(app)
        .post("/api/auth/login")
        .send(credentials);
}

async function seedAndLogin(userAttrs) {
    const user = await seedUser(userAttrs);
    const res = await login({
        username: userAttrs.username,
        password: userAttrs.password,
    });

    return {
        user,
        token: res.body.token,
        loginResponse: res,
    };
}

function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
}

async function issueStoredToken(user, overrides = {}) {
    const token = jwt.sign(
        {
            userId: user._id,
            role: user.role,
            ...overrides.payload,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: overrides.expiresIn || "7d",
        },
    );

    await Token.create({
        token,
        userId: overrides.userId || user._id,
        status: overrides.status || "active",
    });

    return token;
}

module.exports = {
    app,
    seedUser,
    login,
    seedAndLogin,
    authHeader,
    issueStoredToken,
};
