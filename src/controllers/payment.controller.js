const mongoose = require("mongoose");
const Payment = require("../models/payment.model");
const { PAYMENT_METHODS } = require("../models/payment.model");
const Mandoob = require("../models/mandoob.model");
const SalaryLine = require("../models/salaryLine.model");
const Deduction = require("../models/deduction.model");
const { toPayment } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Payment not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const MATCHES_NOTHING = { $in: [] };

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const isPeriod = (value) =>
  typeof value === "string" && PERIOD_PATTERN.test(value);

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const findPaymentById = async (paymentId) => {
  if (!mongoose.isValidObjectId(paymentId)) {
    return null;
  }

  return Payment.findById(paymentId);
};

const snapshotRecipient = (mandoob) => {
  const recipient = (mandoob && mandoob.payoutRecipient) || {};

  return {
    recipientName: recipient.recipientName || "",
    accountOrWalletNumber: recipient.accountOrWalletNumber || "",
    isBigMandoob: Boolean(recipient.isBigMandoob),
  };
};

const sumField = async (Model, match, field) => {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);

  return row ? row.total : 0;
};

const settleAmounts = async (mandoobId, period) => {
  const [gross, deductions] = await Promise.all([
    sumField(SalaryLine, { mandoobId, period }, "totalSalary"),
    sumField(Deduction, { mandoobId }, "amount"),
  ]);

  const grossAmount = round2(gross);
  const deductionsAmount = round2(deductions);

  return {
    grossAmount,
    deductionsAmount,
    netAmount: Math.max(0, round2(grossAmount - deductionsAmount)),
  };
};

const findExistingPayment = (mandoobId, period) =>
  Payment.findOne({ mandoobId, period });

const listPayments = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { mandoobId, period } = req.query;

    const filter = {};

    if (mandoobId) {

      filter.mandoobId = mongoose.isValidObjectId(mandoobId)
        ? mandoobId
        : MATCHES_NOTHING;
    }

    if (period) {

      filter.period = isPeriod(period) ? period : MATCHES_NOTHING;
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: payments.map(toPayment),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createPayment = async (req, res, next) => {
  try {
    const { mandoobId, period, method, netAmount } = req.body || {};

    const details = [];

    if (!mandoobId) {
      details.push({ field: "mandoobId", message: "mandoobId is required" });
    }

    if (!period) {
      details.push({ field: "period", message: "period is required" });
    } else if (!isPeriod(period)) {
      details.push({ field: "period", message: "must be in YYYY-MM format" });
    }

    if (!method) {
      details.push({ field: "method", message: "method is required" });
    } else if (!PAYMENT_METHODS.includes(method)) {
      details.push({
        field: "method",
        message: `must be one of ${PAYMENT_METHODS.join(", ")}`,
      });
    }

    if (netAmount !== undefined) {
      if (typeof netAmount !== "number" || !Number.isFinite(netAmount)) {
        details.push({ field: "netAmount", message: "must be a number" });
      } else if (netAmount < 0) {
        details.push({ field: "netAmount", message: "cannot be negative" });
      }
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const mandoob = mongoose.isValidObjectId(mandoobId)
      ? await Mandoob.findById(mandoobId)
      : null;

    if (!mandoob) {
      return notFound(res, "Mandoob not found");
    }

    const existing = await findExistingPayment(mandoob._id, period);

    if (existing) {

      return conflict(
        res,
        "A payment for this mandoob and period already exists"
      );
    }

    const amounts = await settleAmounts(mandoob._id, period);

    const payment = await Payment.create({
      mandoobId: mandoob._id,
      period,
      grossAmount: amounts.grossAmount,
      deductionsAmount: amounts.deductionsAmount,

      netAmount:
        netAmount !== undefined ? round2(netAmount) : amounts.netAmount,
      method,
      status: "RECORDED",
      recipient: snapshotRecipient(mandoob),

      paidByUserId: req.user._id,
    });

    return res.status(201).json(toPayment(payment));
  } catch (error) {
    if (error.code === 11000) {
      return conflict(
        res,
        "A payment for this mandoob and period already exists"
      );
    }

    return next(error);
  }
};

const runPayout = async (req, res, next) => {
  try {
    const { period, mandoobIds } = req.body || {};

    const details = [];

    if (!period) {
      details.push({ field: "period", message: "period is required" });
    } else if (!isPeriod(period)) {
      details.push({ field: "period", message: "must be in YYYY-MM format" });
    }

    if (mandoobIds === undefined) {
      details.push({ field: "mandoobIds", message: "mandoobIds is required" });
    } else if (!Array.isArray(mandoobIds) || mandoobIds.length === 0) {
      details.push({
        field: "mandoobIds",
        message: "must be a non-empty array of mandoob ids",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const requestedIds = [
      ...new Set(
        mandoobIds.filter((entry) => mongoose.isValidObjectId(entry)).map(String)
      ),
    ];

    if (requestedIds.length === 0) {
      return invalid(res, "Invalid input", [
        { field: "mandoobIds", message: "contains no valid mandoob id" },
      ]);
    }

    const mandoobs = await Mandoob.find({ _id: { $in: requestedIds } });

    if (mandoobs.length === 0) {
      return invalid(res, "Invalid input", [
        { field: "mandoobIds", message: "no id matched an existing mandoob" },
      ]);
    }

    const paid = await Payment.find({
      period,
      mandoobId: { $in: mandoobs.map((mandoob) => mandoob._id) },
    }).select("mandoobId");

    const alreadyPaid = new Set(
      paid.map((payment) => payment.mandoobId.toString())
    );

    const created = [];
    const skipped = [];

    for (const mandoob of mandoobs) {
      if (alreadyPaid.has(mandoob._id.toString())) {
        skipped.push(mandoob._id.toString());
        continue;
      }

      const amounts = await settleAmounts(mandoob._id, period);

      try {
        const payment = await Payment.create({
          mandoobId: mandoob._id,
          period,
          grossAmount: amounts.grossAmount,
          deductionsAmount: amounts.deductionsAmount,
          netAmount: amounts.netAmount,
          method: "PAYOUT_API",

          status: "PENDING",
          recipient: snapshotRecipient(mandoob),
          paidByUserId: req.user._id,
        });

        created.push(payment);
      } catch (error) {

        if (error.code === 11000) {
          skipped.push(mandoob._id.toString());
          continue;
        }

        throw error;
      }
    }

    return res.status(202).json({ payments: created.map(toPayment) });
  } catch (error) {
    return next(error);
  }
};

const getPayment = async (req, res, next) => {
  try {
    const payment = await findPaymentById(req.params.paymentId);

    if (!payment) {
      return notFound(res);
    }

    return res.status(200).json(toPayment(payment));
  } catch (error) {
    return next(error);
  }
};

const attachScreenshot = async (req, res, next) => {
  try {
    const payment = await findPaymentById(req.params.paymentId);

    if (!payment) {
      return notFound(res);
    }

    if (!req.file) {
      return invalid(res, "Invalid input", [
        { field: "file", message: "file is required" },
      ]);
    }

    payment.screenshotUrl = `/uploads/${req.file.filename}`;

    await payment.save();

    return res.status(200).json(toPayment(payment));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPayments,
  createPayment,
  runPayout,
  getPayment,
  attachScreenshot,
};
