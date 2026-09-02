const express = require("express");
const {
  listLoans,
  createLoan,
  getLoan,
  decideLoan,
} = require("../controllers/loan.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
  FINANCE_READERS,
  FINANCE_WRITERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(FINANCE_READERS), listLoans);

// Requesting a loan and deciding one are different acts. The contract
// (openapi-1.yaml:1190) says a loan is "requested by the mandoob (mobile app)
// or by the call center on their behalf", so the request path admits the call
// centre alongside finance. Spelled out rather than reusing STAFF_READERS, so a
// write is not seen to be guarded by a group named for readers.
router.post("/", requireRole(WRITERS, "finance"), createLoan);

router.post("/:loanId/decision", requireRole(FINANCE_WRITERS), decideLoan);

router.get("/:loanId", requireRole(FINANCE_READERS), getLoan);

module.exports = router;
