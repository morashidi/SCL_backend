const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const callRoutes = require("./routes/call.route");
const application = require("./routes/application.route");
const dashboardRoutes = require("./routes/dashboard.routes");
const mandoobRoutes = require("./routes/mandoob.routes");

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/applications", application);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mandoobs", mandoobRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
    res.json({
        message: "SCL BACKEND IS RUNNING"
    });
});

module.exports = app;
