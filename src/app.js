const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const roleRoutes = require("./routes/role.route");
const leadRoutes = require("./routes/lead.route");
const callRoutes = require("./routes/call.route");
const companyRoutes = require("./routes/company.route");
const blocklistRoutes = require("./routes/blocklist.route");
const trainingRoutes = require("./routes/training.route");
const paymentRoutes = require("./routes/payment.route");
const loanRoutes = require("./routes/loan.route");
const deductionRoutes = require("./routes/deduction.route");
const salaryRoutes = require("./routes/salary.route");
const application = require("./routes/application.route");
const dashboardRoutes = require("./routes/dashboard.routes");
const mandoobRoutes = require("./routes/mandoob.routes");

const { notFound, errorHandler } = require("./middleware/error.middleware");
const protect = require("./middleware/auth.middleware");
const {
  requireRole,
  STAFF_READERS,
} = require("./middleware/authorize.middleware");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "SCL BACKEND IS RUNNING"
    });
});

const api = express.Router();

api.use("/auth", authRoutes);
api.use("/users", userRoutes);
api.use("/roles", roleRoutes);
api.use("/leads", leadRoutes);
api.use("/calls", callRoutes);
api.use("/companies", companyRoutes);
api.use("/blocklist", blocklistRoutes);
api.use("/training-sessions", trainingRoutes);
api.use("/payments", paymentRoutes);
api.use("/loans", loanRoutes);
api.use("/deductions", deductionRoutes);
api.use("/salaries", salaryRoutes);
api.use("/applications", application);
api.use("/dashboard", dashboardRoutes);
api.use("/mandoobs", mandoobRoutes);

app.use("/v1", api);

app.use(
  "/uploads",
  protect,
  requireRole(STAFF_READERS),
  express.static(path.join(__dirname, "../uploads"))
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
