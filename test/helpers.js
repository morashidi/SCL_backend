const bcrypt = require("bcryptjs");
const request = require("supertest");
const User = require("../src/models/user.model");
const app = require("../src/app");
const { issueTokens } = require("../src/controllers/auth.controller");

const API = "/v1";

let counter = 0;

const unique = (prefix) => {
  counter += 1;

  return `${prefix}${Date.now().toString(36)}${counter}`;
};

async function seedUser({
  fullName = "Test User",
  username,
  password = "Passw0rd!",
  role,
  phone = null,
  status = "active",
} = {}) {
  return User.create({
    fullName,
    username: (username || unique("user")).toLowerCase(),
    password: await bcrypt.hash(password, 4),
    role,
    phone,
    status,
  });
}

async function login({ username, password = "Passw0rd!" }) {
  return request(app).post(`${API}/auth/login`).send({ username, password });
}

async function actor(role, overrides = {}) {
  const password = overrides.password || "Passw0rd!";
  const user = await seedUser({ ...overrides, role, password });
  const tokens = await issueTokens(user);

  return {
    user,
    id: user._id.toString(),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const as = (token) => {
  const wrap = (method) => (url) =>
    request(app)[method](`${API}${url}`).set(authHeader(token));

  return {
    get: wrap("get"),
    post: wrap("post"),
    patch: wrap("patch"),
    put: wrap("put"),
    delete: wrap("delete"),
  };
};

const anon = () => {
  const wrap = (method) => (url) => request(app)[method](`${API}${url}`);

  return {
    get: wrap("get"),
    post: wrap("post"),
    patch: wrap("patch"),
    put: wrap("put"),
    delete: wrap("delete"),
  };
};

module.exports = {
  API,
  app,
  request,
  unique,
  seedUser,
  login,
  actor,
  authHeader,
  as,
  anon,
};
