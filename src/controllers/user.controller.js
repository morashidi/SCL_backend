const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

const createUser = async (req, res) => {
    try {
        const { name, username, password, role } = req.body;

        if (!name || !username || !password || !role) {
            return res.status(400).json({
                message: "Name, username, password and role are required"
            });
        }

        const normalizedUsername = username.toLowerCase();

        const existingUser = await User.findOne({
            username: normalizedUsername
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        if (req.user.role === "admin" && role !== "call_center") {
            return res.status(403).json({
                message: "Admin can only create call center accounts"
            });
        }

        if (req.user.role === "call_center" && role !== "mandoob") {
            return res.status(403).json({
                message: "Call center can only create delivery man accounts"
            });
        }

        if (req.user.role === "mandoob") {
            return res.status(403).json({
                message: "You are not allowed to create users"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            username: normalizedUsername,
            password: hashedPassword,
            role
        });

        return res.status(201).json({
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Create user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    createUser
};
