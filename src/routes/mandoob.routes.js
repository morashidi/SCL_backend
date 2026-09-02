const express = require("express");
const {
  listMandoobs,
  createMandoob,
  getMandoob,
  updateMandoob,
  listMandoobCompanies,
  linkMandoobCompany,
  updateMandoobCompany,
  unlinkMandoobCompany,
  listMandoobSalaries,
  listMandoobLoans,
  listMandoobDeductions,
} = require("../controllers/mandoob.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
  STAFF_READERS,
  FINANCE_READERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

// The profile itself is staff-wide reference data, plus the mandoob's own row.
const SELF_OR_STAFF = [...STAFF_READERS, "mandoob"];

// The money sub-resources are not: recruiter is excluded here for the same
// reason it is excluded from /v1/loans, /v1/deductions and /v1/payments. A
// mandoob still reaches its own, narrowed by canAccessMandoob in the controller.
const SELF_OR_FINANCE = [...FINANCE_READERS, "mandoob"];

router.get("/", requireRole(STAFF_READERS), listMandoobs);
router.post("/", requireRole(WRITERS), createMandoob);

router.get(
  "/:mandoobId/companies",
  requireRole(STAFF_READERS),
  listMandoobCompanies
);
router.post("/:mandoobId/companies", requireRole(WRITERS), linkMandoobCompany);
router.patch(
  "/:mandoobId/companies/:linkId",
  requireRole(WRITERS),
  updateMandoobCompany
);
router.delete(
  "/:mandoobId/companies/:linkId",
  requireRole(WRITERS),
  unlinkMandoobCompany
);

router.get(
  "/:mandoobId/salaries",
  requireRole(SELF_OR_FINANCE),
  listMandoobSalaries
);
router.get("/:mandoobId/loans", requireRole(SELF_OR_FINANCE), listMandoobLoans);
router.get(
  "/:mandoobId/deductions",
  requireRole(SELF_OR_FINANCE),
  listMandoobDeductions
);

router.get("/:mandoobId", requireRole(SELF_OR_STAFF), getMandoob);
router.patch("/:mandoobId", requireRole(WRITERS), updateMandoob);

module.exports = router;
