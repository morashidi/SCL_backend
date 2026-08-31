const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Token = require("../models/token.model");

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access token is required"
            });
        }

        const token = authHeader.split(" ")[1];

        req.token = token;

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const isTokenValid = await Token.findOne({
            token: token,
            userId: decoded.userId,
            status: "active"
        });
        if (!isTokenValid) {
            return res.status(401).json({
                message: "Invalid or expired access token"
            });
        }

        const user = await User.findById(decoded.userId).select("-password");
        if (!user || user.status === "deleted") {
            return res.status(401).json({
                message: "User not found"
            });
        }

        if (user.role !== decoded.role) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        req.user = user;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired access token"
        });
    }
};

module.exports = protect;
