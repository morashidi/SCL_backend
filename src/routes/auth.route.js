const express = require("express");
const {
    login,
    me,
    logout
} = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", lo2gin);

router.get("/me", protect, me);
router.post("/logout", protect, logout);

module.exports = router;