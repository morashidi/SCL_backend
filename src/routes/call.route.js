const express = require("express");
const {
  listCalls,
  createCall,
  getCall,
  uploadCallRecording,
  getCallRecording,
} = require("../controllers/call.controller");
const protect = require("../middleware/auth.middleware");
const { requireRole, WRITERS } = require("../middleware/authorize.middleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.use(protect);

router.use(requireRole(WRITERS));

router.get("/", listCalls);
router.post("/", createCall);
router.get("/:callId", getCall);

router.post("/:callId/recording", upload.single("file"), uploadCallRecording);
router.get("/:callId/recording", getCallRecording);

module.exports = router;
