const mongoose = require("mongoose");
const Role = require("../models/role.model");
const {
  ROLES,
  ROLE_PERMISSIONS,
  toSpecRole,
  toInternalRole,
} = require("../utils/roles");
const { toRole } = require("../utils/serializers");

const notFound = (res, message = "Role not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const forbidden = (res, message) =>
  res.status(403).json({ code: "FORBIDDEN", message });

const builtInKeyFor = (roleId) => {
  if (typeof roleId !== "string") return null;

  const trimmed = roleId.trim();

  if (ROLES.includes(trimmed)) return trimmed;

  return toInternalRole(trimmed.toUpperCase());
};

const collidesWithBuiltIn = (name) => {
  const candidate = name.trim().toLowerCase();

  return ROLES.some(
    (role) =>
      role.toLowerCase() === candidate ||
      String(toSpecRole(role)).toLowerCase() === candidate
  );
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

const isPermissionList = (value) =>
  Array.isArray(value) && value.every(isNonEmptyString);

const builtInRole = (role) => ({
  id: role,
  name: toSpecRole(role),
  builtIn: true,
  permissions: ROLE_PERMISSIONS[role] || [],
});

const listRoles = async (req, res, next) => {
  try {
    const customRoles = await Role.find().sort({ name: 1 });

    const roles = [
      ...ROLES.map(builtInRole),
      ...customRoles.map((role) => ({
        id: role._id,
        name: role.name,
        builtIn: false,
        permissions: role.permissions,
      })),
    ];

    return res.status(200).json(roles.map(toRole));
  } catch (error) {
    return next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { name, permissions } = req.body || {};

    const details = [];

    if (!isNonEmptyString(name)) {
      details.push({ field: "name", message: "name is required" });
    }

    if (!isPermissionList(permissions)) {
      details.push({
        field: "permissions",
        message: "permissions must be an array of non-empty strings",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid role payload", details);
    }

    if (collidesWithBuiltIn(name)) {
      return conflict(res, "That name belongs to a built-in role");
    }

    const role = await Role.create({
      name: name.trim(),
      permissions: permissions.map((permission) => permission.trim()),
    });

    return res.status(201).json(
      toRole({
        id: role._id,
        name: role.name,
        builtIn: false,
        permissions: role.permissions,
      })
    );
  } catch (error) {

    if (error && error.code === 11000) {
      return conflict(res, "A role with that name already exists");
    }

    return next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    if (builtInKeyFor(roleId)) {
      return forbidden(res, "Built-in roles cannot be modified");
    }

    if (!mongoose.isValidObjectId(roleId)) {
      return notFound(res);
    }

    const { name, permissions } = req.body || {};

    const details = [];

    if (!isPermissionList(permissions)) {
      details.push({
        field: "permissions",
        message: "permissions must be an array of non-empty strings",
      });
    }

    if (name !== undefined && !isNonEmptyString(name)) {
      details.push({
        field: "name",
        message: "name must be a non-empty string",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid role payload", details);
    }

    if (name !== undefined && collidesWithBuiltIn(name)) {
      return conflict(res, "That name belongs to a built-in role");
    }

    const role = await Role.findById(roleId);

    if (!role) {
      return notFound(res);
    }

    role.permissions = permissions.map((permission) => permission.trim());

    if (name !== undefined) {
      role.name = name.trim();
    }

    await role.save();

    return res.status(200).json(
      toRole({
        id: role._id,
        name: role.name,
        builtIn: false,
        permissions: role.permissions,
      })
    );
  } catch (error) {
    if (error && error.code === 11000) {
      return conflict(res, "A role with that name already exists");
    }

    return next(error);
  }
};

module.exports = {
  listRoles,
  createRole,
  updateRole,
};
