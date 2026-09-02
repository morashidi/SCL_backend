const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Token = require("../models/token.model");
const { toUser } = require("../utils/serializers");
const { parsePagination, escapeRegex } = require("../utils/pagination");
const {
  ROLES,
  toSpecRole,
  toInternalRole,
  rankOf,
  canCreateRole,
  rolesBelow,
} = require("../utils/roles");

const MIN_PASSWORD_LENGTH = 8;

const SEES_EVERYONE = ["system_admin", "admin"];

const forbidden = (res, message) =>
  res.status(403).json({ code: "FORBIDDEN", message });

const notFound = (res, message = "User not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const canManageUser = (actor, target) =>
  rankOf(actor.role) > rankOf(target.role);

const isSameUser = (actor, target) =>
  actor._id.toString() === target._id.toString();

const canViewUser = (actor, target) =>
  SEES_EVERYONE.includes(actor.role) ||
  isSameUser(actor, target) ||
  canManageUser(actor, target);

const findUserById = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    return null;
  }

  return User.findOne({ _id: userId, status: { $ne: "deleted" } });
};

const createUser = async (req, res, next) => {
  try {
    const { fullName, username, phone, password, role } = req.body || {};

    const details = [];

    if (!fullName) {
      details.push({ field: "fullName", message: "fullName is required" });
    }

    if (!username) {
      details.push({ field: "username", message: "username is required" });
    }

    if (!password) {
      details.push({ field: "password", message: "password is required" });
    } else if (String(password).length < MIN_PASSWORD_LENGTH) {
      details.push({
        field: "password",
        message: `must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    if (!role) {
      details.push({ field: "role", message: "role is required" });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const internalRole = toInternalRole(role);

    if (!internalRole) {
      return invalid(res, `Unsupported role: ${role}`, [
        {
          field: "role",
          message: `must be one of ${ROLES.map(toSpecRole).join(", ")}`,
        },
      ]);
    }

    if (!canCreateRole(req.user.role, internalRole)) {
      return forbidden(
        res,
        `Your role cannot create ${toSpecRole(internalRole)} accounts`
      );
    }

    const normalizedUsername = String(username).toLowerCase().trim();

    const existingUser = await User.findOne({ username: normalizedUsername });

    if (existingUser) {
      return conflict(res, "Username already exists");
    }

    const user = await User.create({
      fullName,
      username: normalizedUsername,
      phone: phone || null,
      password: await bcrypt.hash(password, 10),
      role: internalRole,
    });

    return res.status(201).json(toUser(user));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "Username already exists");
    }

    return next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { role, search } = req.query;

    const filter = { status: { $ne: "deleted" } };
    const conditions = [];

    if (!SEES_EVERYONE.includes(req.user.role)) {
      conditions.push({
        $or: [
          { role: { $in: rolesBelow(req.user.role) } },
          { _id: req.user._id },
        ],
      });
    }

    if (role) {

      filter.role = toInternalRole(role) || "__none__";
    }

    if (search) {
      const pattern = new RegExp(escapeRegex(String(search)), "i");

      conditions.push({
        $or: [{ fullName: pattern }, { username: pattern }, { phone: pattern }],
      });
    }

    if (conditions.length > 0) {
      filter.$and = conditions;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    return res.status(200).json({
      page,
      pageSize,
      total,
      items: users.map(toUser),
    });
  } catch (error) {
    return next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      return notFound(res);
    }

    if (!canViewUser(req.user, user)) {
      return forbidden(res, "You are not allowed to view this user");
    }

    return res.status(200).json(toUser(user));
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      return notFound(res);
    }

    if (!isSameUser(req.user, user) && !canManageUser(req.user, user)) {
      return forbidden(res, "You are not allowed to update this user");
    }

    const { fullName, phone, password, active } = req.body || {};

    if (
      password !== undefined &&
      String(password).length < MIN_PASSWORD_LENGTH
    ) {
      return invalid(res, "Invalid input", [
        {
          field: "password",
          message: `must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
      ]);
    }

    if (fullName !== undefined) {
      user.fullName = fullName;
    }

    if (phone !== undefined) {
      user.phone = phone || null;
    }

    if (password !== undefined) {
      user.password = await bcrypt.hash(password, 10);
    }

    if (active !== undefined) {

      if (!canManageUser(req.user, user)) {
        return forbidden(res, "You are not allowed to change active status");
      }

      user.status = active ? "active" : "inactive";

      if (!active) {
        await Token.updateMany(
          { userId: user._id, status: "active" },
          { status: "inactive" }
        );
      }
    }

    await user.save();

    return res.status(200).json(toUser(user));
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      return notFound(res);
    }

    if (user.role === "system_admin") {
      return forbidden(
        res,
        "The System Administrator account cannot be removed"
      );
    }

    if (!canManageUser(req.user, user)) {
      return forbidden(res, "You are not allowed to delete this user");
    }

    await Token.deleteMany({ userId: user._id });

    user.status = "deleted";
    await user.save();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
};
