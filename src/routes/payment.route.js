const express = require("express");
const {
  listPayments,
  createPayment,
  runPayout,
  getPayment,
  attachScreenshot,
} = require("../controllers/payment.controller");
const protect = require("../middleware/auth.middleware");
const {
  requireRole,
  FINANCE_READERS,
  FINANCE_WRITERS,
} = require("../middleware/authorize.middleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.use(protect);

router.get("/", requireRole(FINANCE_READERS), listPayments);
router.post("/", requireRole(FINANCE_WRITERS), createPayment);

router.post("/payout", requireRole(FINANCE_WRITERS), runPayout);

router.post(
  "/:paymentId/screenshot",
  requireRole(FINANCE_WRITERS),
  upload.single("file"),
  attachScreenshot
);

router.get("/:paymentId", requireRole(FINANCE_READERS), getPayment);

module.exports = router;
