const express = require("express");
const {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} = require("../controllers/user.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

// Reads carry no role guard on purpose: the controller scopes them per
// requester (admins see everyone, everyone else sees themselves plus whoever
// they outrank), so a guard here would only duplicate that or contradict it.
router.get("/", listUsers);
router.get("/:userId", getUser);

// PATCH is likewise unguarded because it is also the self-service path - any
// user changes their own name, phone or password here. The controller enforces
// "self or outranks", and gates the `active` flag on outranking alone.
router.patch("/:userId", updateUser);

// Creating and removing accounts is account administration, not a money or
// self-service action. Without this guard the rank ladder alone let `finance`
// (rank 2) delete any mandoob (rank 1) - which contradicts ROLE_PERMISSIONS,
// where finance holds no users.* permission at all. The controller still
// narrows further via canCreateRole and canManageUser.
router.post("/", requireRole(WRITERS), createUser);
router.delete("/:userId", requireRole(WRITERS), deleteUser);

module.exports = router;
