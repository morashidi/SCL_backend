const express = require("express");

const {
  createMandoobProfile,
  getMandoobProfile,
  updateMandoobProfile,
} = require("../controllers/mandoob.controller");

const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  createMandoobProfile
);

router.get(
  "/:userId",
  authMiddleware,
  getMandoobProfile
);

router.put(
  "/:userId",
  authMiddleware,
  updateMandoobProfile
);

module.exports = router;