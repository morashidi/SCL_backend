const express = require("express");
const {
  listBlockEntries,
  createBlockEntry,
  checkBlocklist,
  unblockEntry,
} = require("../controllers/blocklist.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
  STAFF_READERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(STAFF_READERS), listBlockEntries);
router.post("/", requireRole(WRITERS), createBlockEntry);

router.get("/check", requireRole(STAFF_READERS), checkBlocklist);

router.post("/:entryId/unblock", requireRole(WRITERS), unblockEntry);

module.exports = router;
