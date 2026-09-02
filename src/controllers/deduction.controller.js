const mongoose = require("mongoose");
const Deduction = require("../models/deduction.model");
const { DEDUCTION_TYPES } = require("../models/deduction.model");
const Loan = require("../models/loan.model");
const Mandoob = require("../models/mandoob.model");
const { toDeduction } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Deduction not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const MATCHES_NOTHING = { $in: [] };

const isPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const findDeductionById = async (deductionId) => {
  if (!mongoose.isValidObjectId(deductionId)) {
    return null;
  }

  return Deduction.findById(deductionId);
};

const findLoanForMandoob = async (loanId, mandoobId) => {
  if (!mongoose.isValidObjectId(loanId)) {
    return null;
  }

  return Loan.findOne({ _id: loanId, mandoobId });
};

const listDeductions = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { mandoobId, type } = req.query;

    const filter = {};

    if (mandoobId) {
      filter.mandoobId = mongoose.isValidObjectId(mandoobId)
        ? mandoobId
        : MATCHES_NOTHING;
    }

    if (type) {

      filter.type = DEDUCTION_TYPES.includes(type) ? type : MATCHES_NOTHING;
    }

    const [total, deductions] = await Promise.all([
      Deduction.countDocuments(filter),
      Deduction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: deductions.map(toDeduction),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createDeduction = async (req, res, next) => {
  try {
    const { mandoobId, type, amount, reason, loanId } = req.body || {};

    const details = [];

    if (mandoobId === undefined || mandoobId === null || mandoobId === "") {
      details.push({ field: "mandoobId", message: "mandoobId is required" });
    } else if (!mongoose.isValidObjectId(mandoobId)) {
      details.push({ field: "mandoobId", message: "must be a valid id" });
    }

    if (type === undefined || type === null || type === "") {
      details.push({ field: "type", message: "type is required" });
    } else if (!DEDUCTION_TYPES.includes(type)) {
      details.push({
        field: "type",
        message: `must be one of ${DEDUCTION_TYPES.join(", ")}`,
      });
    }

    if (amount === undefined || amount === null) {
      details.push({ field: "amount", message: "amount is required" });
    } else if (!isPositiveNumber(amount)) {
      details.push({ field: "amount", message: "must be a positive number" });
    }

    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      details.push({ field: "reason", message: "must be a string" });
    }

    if (
      loanId !== undefined &&
      loanId !== null &&
      !mongoose.isValidObjectId(loanId)
    ) {
      details.push({ field: "loanId", message: "must be a valid id" });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const mandoob = await Mandoob.findById(mandoobId);

    if (!mandoob) {
      return notFound(res, "Mandoob not found");
    }

    let loan = null;

    if (loanId) {
      loan = await findLoanForMandoob(loanId, mandoob._id);

      if (!loan) {
        return notFound(res, "Loan not found");
      }
    }

    const deduction = await Deduction.create({
      mandoobId: mandoob._id,
      type,
      amount: round2(amount),
      reason: reason || "",
      loanId: loan ? loan._id : null,

      recordedByUserId: req.user._id,
    });

    return res.status(201).json(toDeduction(deduction));
  } catch (error) {
    return next(error);
  }
};

const updateDeduction = async (req, res, next) => {
  try {
    const deduction = await findDeductionById(req.params.deductionId);

    if (!deduction) {
      return notFound(res);
    }

    const { mandoobId, type, amount, reason, loanId } = req.body || {};

    const details = [];

    if (mandoobId !== undefined) {
      if (mandoobId === null || mandoobId === "") {
        details.push({ field: "mandoobId", message: "mandoobId is required" });
      } else if (!mongoose.isValidObjectId(mandoobId)) {
        details.push({ field: "mandoobId", message: "must be a valid id" });
      }
    }

    if (type !== undefined) {
      if (!DEDUCTION_TYPES.includes(type)) {
        details.push({
          field: "type",
          message: `must be one of ${DEDUCTION_TYPES.join(", ")}`,
        });
      }
    }

    if (amount !== undefined && !isPositiveNumber(amount)) {
      details.push({ field: "amount", message: "must be a positive number" });
    }

    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      details.push({ field: "reason", message: "must be a string" });
    }

    if (
      loanId !== undefined &&
      loanId !== null &&
      loanId !== "" &&
      !mongoose.isValidObjectId(loanId)
    ) {
      details.push({ field: "loanId", message: "must be a valid id" });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    if (mandoobId !== undefined) {
      const mandoob = await Mandoob.findById(mandoobId);

      if (!mandoob) {
        return notFound(res, "Mandoob not found");
      }

      deduction.mandoobId = mandoob._id;
    }

    const nextLoanId =
      loanId === undefined
        ? deduction.loanId
        : loanId === null || loanId === ""
        ? null
        : loanId;

    if (nextLoanId && (loanId !== undefined || mandoobId !== undefined)) {
      const loan = await findLoanForMandoob(nextLoanId, deduction.mandoobId);

      if (!loan) {
        return notFound(res, "Loan not found");
      }

      deduction.loanId = loan._id;
    } else if (loanId !== undefined) {
      deduction.loanId = null;
    }

    if (type !== undefined) {
      deduction.type = type;
    }

    if (amount !== undefined) {
      deduction.amount = round2(amount);
    }

    if (reason !== undefined) {
      deduction.reason = reason || "";
    }

    await deduction.save();

    return res.status(200).json(toDeduction(deduction));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listDeductions,
  createDeduction,
  updateDeduction,
};
