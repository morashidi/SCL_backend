const express = require("express");
const {
  listCompanies,
  createCompany,
  getCompany,
  updateCompany,
} = require("../controllers/company.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
  STAFF_READERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(STAFF_READERS), listCompanies);
router.post("/", requireRole(WRITERS), createCompany);
router.get("/:companyId", requireRole(STAFF_READERS), getCompany);
router.patch("/:companyId", requireRole(WRITERS), updateCompany);

module.exports = router;
