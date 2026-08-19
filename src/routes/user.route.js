const express = require("express");
const { createUser } = require("../controllers/user.controller");
const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", protect, createUser);

module.exports = router;
