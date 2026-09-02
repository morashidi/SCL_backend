const TO_SPEC = {
  system_admin: "SYSTEM_ADMIN",
  admin: "OWNER_ADMIN",
  finance: "FINANCE",
  recruiter: "CALL_CENTER",
  mandoob: "MANDOOB",
};

const TO_INTERNAL = Object.fromEntries(
  Object.entries(TO_SPEC).map(([internal, spec]) => [spec, internal])
);

const ROLES = Object.keys(TO_SPEC);

const ROLE_RANK = {
  system_admin: 4,
  admin: 3,
  finance: 2,
  recruiter: 2,
  mandoob: 1,
};

const CAN_CREATE = {
  system_admin: ROLES,
  admin: ["finance", "recruiter", "mandoob"],
  finance: [],
  recruiter: ["mandoob"],
  mandoob: [],
};

const ROLE_PERMISSIONS = {
  system_admin: [
    "users.create",
    "users.read",
    "users.update",
    "users.delete",
    "roles.read",
  ],
  admin: [
    "users.create",
    "users.read",
    "users.update",
    "users.delete",
    "roles.read",
  ],
  finance: ["users.read.self", "roles.read"],
  recruiter: ["users.create", "users.read", "roles.read"],
  mandoob: ["users.read.self"],
};

const toSpecRole = (role) => TO_SPEC[role] || null;

const toInternalRole = (roleName) => TO_INTERNAL[roleName] || null;

const rankOf = (role) => ROLE_RANK[role] || 0;

const canCreateRole = (actorRole, targetRole) =>
  (CAN_CREATE[actorRole] || []).includes(targetRole);

const rolesBelow = (role) =>
  ROLES.filter((candidate) => rankOf(candidate) < rankOf(role));

module.exports = {
  TO_SPEC,
  TO_INTERNAL,
  ROLES,
  ROLE_RANK,
  ROLE_PERMISSIONS,
  CAN_CREATE,
  toSpecRole,
  toInternalRole,
  rankOf,
  canCreateRole,
  rolesBelow,
};
