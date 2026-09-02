const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Token = require("../models/token.model");

const unauthorized = (res, message) =>
  res.status(401).json({
    code: "UNAUTHORIZED",
    message,
  });

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, "Access token is required");
    }

    const token = authHeader.split(" ")[1];

    req.token = token;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.kind !== "access") {
      return unauthorized(res, "Invalid or expired access token");
    }

    const isTokenValid = await Token.findOne({
      token: token,
      type: "access",
      status: "active",
      userId: decoded.userId,
    });

    if (!isTokenValid) {
      return unauthorized(res, "Invalid or expired access token");
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user || user.status === "deleted") {
      return unauthorized(res, "User not found");
    }

    if (user.status !== "active") {
      return unauthorized(res, "Account is not active");
    }

    if (user.role !== decoded.role) {
      return unauthorized(res, "Unauthorized");
    }

    req.user = user;

    next();
  } catch (error) {
    return unauthorized(res, "Invalid or expired access token");
  }
};

module.exports = protect;
