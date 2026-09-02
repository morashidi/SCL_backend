const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Token = require("../models/token.model");
const { toUser } = require("../utils/serializers");

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL || 60 * 60);
const REFRESH_TTL_SECONDS = Number(
  process.env.REFRESH_TOKEN_TTL || 60 * 60 * 24 * 30
);

const unauthorized = (res, message = "Invalid credentials") =>
  res.status(401).json({
    code: "UNAUTHORIZED",
    message,
  });

const sign = (user, kind, ttlSeconds) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
      kind,
    },
    process.env.JWT_SECRET,
    { expiresIn: ttlSeconds }
  );

const issueTokens = async (user) => {
  const accessToken = sign(user, "access", ACCESS_TTL_SECONDS);
  const refreshToken = sign(user, "refresh", REFRESH_TTL_SECONDS);

  const now = Date.now();

  await Token.create([
    {
      token: accessToken,
      userId: user._id,
      type: "access",
      expiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    },
    {
      token: refreshToken,
      userId: user._id,
      type: "refresh",
      expiresAt: new Date(now + REFRESH_TTL_SECONDS * 1000),
    },
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
  };
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return unauthorized(res, "Username and password are required");
    }

    const identifier = String(username).trim();

    const user = await User.findOne({
      status: { $ne: "deleted" },
      $or: [{ username: identifier.toLowerCase() }, { phone: identifier }],
    });

    if (!user) {
      return unauthorized(res, "Invalid username or password");
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return unauthorized(res, "Invalid username or password");
    }

    if (user.status !== "active") {
      return unauthorized(res, "Account is not active");
    }

    return res.status(200).json(await issueTokens(user));
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return unauthorized(res, "refreshToken is required");
    }

    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return unauthorized(res, "Invalid or expired refresh token");
    }

    if (decoded.kind !== "refresh") {
      return unauthorized(res, "Invalid or expired refresh token");
    }

    const stored = await Token.findOneAndUpdate(
      {
        token: refreshToken,
        type: "refresh",
        status: "active",
        userId: decoded.userId,
      },
      { status: "inactive" }
    );

    if (!stored) {
      return unauthorized(res, "Invalid or expired refresh token");
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status !== "active") {
      return unauthorized(res, "Account is not active");
    }

    return res.status(200).json(await issueTokens(user));
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    return res.status(200).json(toUser(req.user));
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await Token.updateMany(
      {
        userId: req.user._id,
        status: "active",
        $or: [{ token: req.token }, { type: "refresh" }],
      },
      { status: "inactive" }
    );

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  refresh,
  me,
  logout,
  issueTokens,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
};
