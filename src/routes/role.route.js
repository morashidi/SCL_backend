const express = require("express");
const {
  listRoles,
  createRole,
  updateRole,
} = require("../controllers/role.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  STAFF_READERS,
  SYSTEM_ADMINS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

// Reference data a role picker needs, but a mandoob has no role picker - and
// the catalogue lists every permission in the system.
router.get("/", requireRole(STAFF_READERS), listRoles);

router.post("/", requireRole(SYSTEM_ADMINS), createRole);
router.patch("/:roleId", requireRole(SYSTEM_ADMINS), updateRole);

module.exports = router;
