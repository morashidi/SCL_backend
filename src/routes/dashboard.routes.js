const express = require("express");
const {
  getDashboardSummary,
  getAgentLeaderboard,
} = require("../controllers/dashboard.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  FINANCE_READERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect, requireRole(FINANCE_READERS));

router.get("/summary", getDashboardSummary);
router.get("/agent-leaderboard", getAgentLeaderboard);

module.exports = router;
