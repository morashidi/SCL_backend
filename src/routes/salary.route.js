const express = require("express");
const {
  listSalaryImports,
  createSalaryImport,
  getSalaryImport,
  commitSalaryImport,
  listSalaryLines,
  createSalaryLine,
} = require("../controllers/salary.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  FINANCE_READERS,
  FINANCE_WRITERS,
} = require("../middleware/authorize.middleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.use(protect);

const uploadSheet = upload.single("file");

router.get("/imports", requireRole(FINANCE_READERS), listSalaryImports);
router.post(
  "/imports",
  requireRole(FINANCE_WRITERS),
  uploadSheet,
  createSalaryImport
);

router.post(
  "/imports/:importId/commit",
  requireRole(FINANCE_WRITERS),
  commitSalaryImport
);
router.get("/imports/:importId", requireRole(FINANCE_READERS), getSalaryImport);

router.get("/lines", requireRole(FINANCE_READERS), listSalaryLines);
router.post("/lines", requireRole(FINANCE_WRITERS), createSalaryLine);

module.exports = router;
