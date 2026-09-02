const express = require("express");
const {
  listDeductions,
  createDeduction,
  updateDeduction,
} = require("../controllers/deduction.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  FINANCE_READERS,
  FINANCE_WRITERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(FINANCE_READERS), listDeductions);
router.post("/", requireRole(FINANCE_WRITERS), createDeduction);
router.patch("/:deductionId", requireRole(FINANCE_WRITERS), updateDeduction);

module.exports = router;
