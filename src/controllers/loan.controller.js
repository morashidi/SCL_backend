const mongoose = require("mongoose");
const Loan = require("../models/loan.model");
const { LOAN_STATUSES } = require("../models/loan.model");
const Mandoob = require("../models/mandoob.model");
const { toLoan } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Loan not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const forbidden = (res, message) =>
  res.status(403).json({ code: "FORBIDDEN", message });

const conflict = (res, message) =>
  res.status(409).json({ code: "CONFLICT", message });

const MATCHES_NOTHING = { $in: [] };

const isPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isPositiveInteger = (value) =>
  isPositiveNumber(value) && Number.isInteger(value);

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const addMonths = (date, months) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const lastDayOfTarget = new Date(
    Date.UTC(year, month + months + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(year, month + months, Math.min(day, lastDayOfTarget))
  );
};

const isEligibleForLoan = async (mandoobId) => {
  const outstanding = await Loan.exists({
    mandoobId,
    status: "APPROVED",
    remainingBalance: { $gt: 0 },
  });

  return !outstanding;
};

const buildSchedule = ({
  principal,
  installmentAmount,
  installmentsCount,
  from,
}) => {
  const schedule = [];

  let allocated = 0;

  for (let number = 1; number <= installmentsCount; number += 1) {

    const amount =
      number === installmentsCount
        ? round2(principal - allocated)
        : installmentAmount;

    allocated = round2(allocated + amount);

    schedule.push({
      number,
      amount,
      dueDate: addMonths(from, number),
      paid: false,
    });
  }

  return schedule;
};

const findLoanById = async (loanId) => {
  if (!mongoose.isValidObjectId(loanId)) {
    return null;
  }

  return Loan.findById(loanId);
};

const listLoans = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { mandoobId, status } = req.query;

    const filter = {};

    if (mandoobId) {
      filter.mandoobId = mongoose.isValidObjectId(mandoobId)
        ? mandoobId
        : MATCHES_NOTHING;
    }

    if (status) {

      filter.status = LOAN_STATUSES.includes(status) ? status : MATCHES_NOTHING;
    }

    const [total, loans] = await Promise.all([
      Loan.countDocuments(filter),
      Loan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res
      .status(200)
      .json(paginated({ page, pageSize, total, items: loans.map(toLoan) }));
  } catch (error) {
    return next(error);
  }
};

const createLoan = async (req, res, next) => {
  try {
    const { mandoobId, principal, installmentsCount, installmentAmount } =
      req.body || {};

    const details = [];

    if (mandoobId === undefined || mandoobId === null || mandoobId === "") {
      details.push({ field: "mandoobId", message: "mandoobId is required" });
    } else if (!mongoose.isValidObjectId(mandoobId)) {
      details.push({ field: "mandoobId", message: "must be a valid id" });
    }

    if (principal === undefined || principal === null) {
      details.push({ field: "principal", message: "principal is required" });
    } else if (!isPositiveNumber(principal)) {
      details.push({ field: "principal", message: "must be a positive number" });
    }

    if (installmentsCount === undefined || installmentsCount === null) {
      details.push({
        field: "installmentsCount",
        message: "installmentsCount is required",
      });
    } else if (!isPositiveInteger(installmentsCount)) {
      details.push({
        field: "installmentsCount",
        message: "must be a positive integer",
      });
    }

    if (
      installmentAmount !== undefined &&
      installmentAmount !== null &&
      !isPositiveNumber(installmentAmount)
    ) {
      details.push({
        field: "installmentAmount",
        message: "must be a positive number",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const roundedPrincipal = round2(principal);

    const effectiveInstallmentAmount =
      installmentAmount === undefined || installmentAmount === null
        ? round2(roundedPrincipal / installmentsCount)
        : round2(installmentAmount);

    const allocatedBeforeLast = round2(
      effectiveInstallmentAmount * (installmentsCount - 1)
    );

    if (allocatedBeforeLast > roundedPrincipal) {
      return invalid(res, "Invalid input", [
        {
          field: "installmentAmount",
          message:
            "installmentAmount and installmentsCount do not fit within principal",
        },
      ]);
    }

    const mandoob = await Mandoob.findById(mandoobId);

    if (!mandoob) {
      return notFound(res, "Mandoob not found");
    }

    const createdAt = new Date();

    const loan = await Loan.create({
      mandoobId: mandoob._id,
      principal: roundedPrincipal,
      installmentAmount: effectiveInstallmentAmount,
      installmentsCount,
      installmentsPaid: 0,
      remainingBalance: roundedPrincipal,
      status: "PENDING",

      eligible: await isEligibleForLoan(mandoob._id),
      exceptionApproved: false,
      decisionByUserId: null,
      decisionReason: null,
      schedule: buildSchedule({
        principal: roundedPrincipal,
        installmentAmount: effectiveInstallmentAmount,
        installmentsCount,
        from: createdAt,
      }),
    });

    return res.status(201).json(toLoan(loan));
  } catch (error) {
    return next(error);
  }
};

const getLoan = async (req, res, next) => {
  try {
    const loan = await findLoanById(req.params.loanId);

    if (!loan) {
      return notFound(res);
    }

    return res.status(200).json(toLoan(loan));
  } catch (error) {
    return next(error);
  }
};

const decideLoan = async (req, res, next) => {
  try {
    const loan = await findLoanById(req.params.loanId);

    if (!loan) {
      return notFound(res);
    }

    const { decision, exception, reason } = req.body || {};

    const details = [];

    if (decision === undefined || decision === null || decision === "") {
      details.push({ field: "decision", message: "decision is required" });
    } else if (decision !== "APPROVE" && decision !== "REJECT") {
      details.push({
        field: "decision",
        message: "must be one of APPROVE, REJECT",
      });
    }

    if (
      exception !== undefined &&
      exception !== null &&
      typeof exception !== "boolean"
    ) {
      details.push({ field: "exception", message: "must be a boolean" });
    }

    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      details.push({ field: "reason", message: "must be a string" });
    }

    const isException = exception === true;

    if (isException && (typeof reason !== "string" || reason.trim() === "")) {
      details.push({
        field: "reason",
        message: "reason is required when exception is true",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    if (loan.status !== "PENDING") {
      return conflict(res, "This loan has already been decided");
    }

    const isApproval = decision === "APPROVE";

    if (isApproval && !loan.eligible && !isException) {
      return forbidden(
        res,
        "This mandoob is not eligible for a loan; approval requires exception=true with a reason"
      );
    }

    loan.status = isApproval ? "APPROVED" : "REJECTED";

    loan.exceptionApproved = isApproval && isException && !loan.eligible;
    loan.decisionByUserId = req.user._id;
    loan.decisionReason =
      typeof reason === "string" && reason.trim() !== "" ? reason : null;

    await loan.save();

    return res.status(200).json(toLoan(loan));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listLoans,
  createLoan,
  getLoan,
  decideLoan,
};
