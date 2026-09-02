const WRITERS = ["system_admin", "admin", "recruiter"];

const STAFF_READERS = ["system_admin", "admin", "recruiter", "finance"];

const FINANCE_WRITERS = ["system_admin", "admin", "finance"];

const FINANCE_READERS = ["system_admin", "admin", "finance"];

const SYSTEM_ADMINS = ["system_admin"];

const requireRole = (...allowedRoles) => {
  const allowed = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Authentication is required",
      });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "You are not allowed to perform this action",
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  WRITERS,
  STAFF_READERS,
  FINANCE_READERS,
  FINANCE_WRITERS,
  SYSTEM_ADMINS,
};
