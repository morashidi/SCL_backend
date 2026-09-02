const express = require("express");
const {
  listTrainingSessions,
  createTrainingSession,
  getTrainingSession,
  listTrainingAssignments,
  assignMandoobToSession,
} = require("../controllers/training.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  WRITERS,
  STAFF_READERS,
} = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(STAFF_READERS), listTrainingSessions);
router.post("/", requireRole(WRITERS), createTrainingSession);

router.get(
  "/:sessionId/assignments",
  requireRole(STAFF_READERS),
  listTrainingAssignments
);
router.post(
  "/:sessionId/assignments",
  requireRole(WRITERS),
  assignMandoobToSession
);

router.get("/:sessionId", requireRole(STAFF_READERS), getTrainingSession);

module.exports = router;
