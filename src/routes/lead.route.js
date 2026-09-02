const express = require("express");
const {
  listLeads,
  createLeads,
  getLead,
  rescheduleLead,
} = require("../controllers/lead.controller");
const protect = require("../middleware/auth.middleware");
const { requireRole, WRITERS } = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.use(requireRole(WRITERS));

router.get("/", listLeads);
router.post("/", createLeads);
router.get("/:leadId", getLead);
router.post("/:leadId/reschedule", rescheduleLead);

module.exports = router;
