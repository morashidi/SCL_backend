const express = require("express");
const {
    createUser,
    listUsers,
    getUser,
    updateUser,
    deleteUser,
} = require("../controllers/user.controller");
const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, listUsers);
router.post("/", protect, createUser);
router.get("/:userId", protect, getUser);
router.patch("/:userId", protect, updateUser);
router.delete("/:userId", protect, deleteUser);

module.exports = router;
