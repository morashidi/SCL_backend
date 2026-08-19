require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const callRoutes = require("./routes/call.route");
const  application = require("./routes/application.route");
const path = require("path");


const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/applications", application);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

connectDB();

app.get("/", (req, res) => {
    res.json({
        message: "SCL BACKEND IS RUNNING"
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});