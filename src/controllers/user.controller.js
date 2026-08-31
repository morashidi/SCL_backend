const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Token = require("../models/token.model");

const ROLE_RANK = {
    admin: 3,
    call_center: 2,
    mandoob: 1,
};

const toPublicUser = (user) => ({
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
});

const canManageUser = (actor, target) => {
    const actorRank = ROLE_RANK[actor.role] || 0;
    const targetRank = ROLE_RANK[target.role] || 0;

    return actorRank > targetRank;
};

const isSameUser = (actor, target) => {
    return actor._id.toString() === target._id.toString();
};

const findUserById = async (userId) => {
    if (!mongoose.isValidObjectId(userId)) {
        return null;
    }

    return User.findOne({
        _id: userId,
        status: { $ne: "deleted" },
    });
};

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
            user: toPublicUser(user)
        });

    } catch (error) {
        console.error("Create user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const listUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20)
        );
        const { role, search } = req.query;

        const filter = {
            status: { $ne: "deleted" },
        };

        if (role) {
            filter.role = role;
        }

        if (search) {
            const pattern = new RegExp(search, "i");

            filter.$or = [
                { name: pattern },
                { username: pattern }
            ];
        }

        const [total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select("-password")
                .sort({ createdAt: -1, })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
        ]);

        return res.status(200).json({
            page,
            pageSize,
            total,
            items: users.map(toPublicUser)
        });
    } catch (error) {
        console.error("List users error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getUser = async (req, res) => {
    try {
        const user = await findUserById(req.params.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user: toPublicUser(user)
        });
    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const user = await findUserById(req.params.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (!isSameUser(req.user, user) && !canManageUser(req.user, user)) {
            return res.status(403).json({
                message: "You are not allowed to update this user"
            });
        }

        const { name, password } = req.body;

        if (name) {
            user.name = name;
        }

        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        return res.status(200).json({
            message: "User updated successfully",
            user: toPublicUser(user)
        });
    } catch (error) {
        console.error("Update user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await findUserById(req.params.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (!canManageUser(req.user, user)) {
            return res.status(403).json({
                message: "You are not allowed to delete this user"
            });
        }

        await Token.deleteMany({ userId: user._id });
        user.status = "deleted";
        await user.save();

        return res.status(204).send();
    } catch (error) {
        console.error("Delete user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    createUser,
    listUsers,
    getUser,
    updateUser,
    deleteUser
};
