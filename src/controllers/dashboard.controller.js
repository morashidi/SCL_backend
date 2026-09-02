const Call = require("../models/call.model");
const { CALL_OUTCOMES } = require("../models/lead.model");
const Mandoob = require("../models/mandoob.model");
const { EMPLOYMENT_STATUSES } = require("../models/mandoob.model");
const MandoobCompany = require("../models/mandoobCompany.model");
const Loan = require("../models/loan.model");
const Deduction = require("../models/deduction.model");
const Payment = require("../models/payment.model");
const BlockEntry = require("../models/blockEntry.model");

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const CONTACTED_OUTCOMES = [
  "INTERESTED",
  "NOT_INTERESTED",
  "DECLINED",
  "REQUESTED_CALLBACK",
];

const CONVERTED_OUTCOME = "INTERESTED";

const DISBURSED_PAYMENT_STATUSES = ["RECORDED", "PAID"];

const OUTSTANDING_LOAN_STATUS = "APPROVED";

const round2 = (value) =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const percentage = (numerator, denominator) =>
  denominator > 0 ? round2((numerator / denominator) * 100) : 0;

const parseDateRange = (query) => {
  const details = [];

  const parseBound = (field, endOfDay) => {
    const value = query[field];

    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value !== "string" || !DATE_ONLY.test(value)) {
      details.push({ field, message: `${field} must be a date as YYYY-MM-DD` });
      return null;
    }

    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const parsed = new Date(`${value}${suffix}`);

    if (Number.isNaN(parsed.getTime())) {
      details.push({ field, message: `${field} is not a valid date` });
      return null;
    }

    return parsed;
  };

  const from = parseBound("from", false);
  const to = parseBound("to", true);

  if (from && to && from > to) {
    details.push({ field: "to", message: "to must not precede from" });
  }

  return { from, to, details };
};

const dateFilter = (field, range) => {
  if (!range.from && !range.to) {
    return {};
  }

  const bounds = {};

  if (range.from) bounds.$gte = range.from;
  if (range.to) bounds.$lte = range.to;

  return { [field]: bounds };
};

const countMap = (rows, keys) => {
  const map = {};

  keys.forEach((key) => {
    map[key] = 0;
  });

  rows.forEach((row) => {
    if (row._id !== null && row._id !== undefined) {
      map[row._id] = row.count;
    }
  });

  return map;
};

const callOutcomeCounts = (range) =>
  Call.aggregate([
    { $match: dateFilter("calledAt", range) },
    { $group: { _id: "$outcome", count: { $sum: 1 } } },
  ]);

const loanTotals = (now) =>
  Loan.aggregate([
    { $match: { status: { $in: ["APPROVED", "CLOSED"] } } },
    {
      $group: {
        _id: null,
        outstanding: {
          $sum: {
            $cond: [
              { $eq: ["$status", OUTSTANDING_LOAN_STATUS] },
              { $ifNull: ["$remainingBalance", 0] },
              0,
            ],
          },
        },

        recovered: {
          $sum: {
            $subtract: [
              { $ifNull: ["$principal", 0] },
              { $ifNull: ["$remainingBalance", 0] },
            ],
          },
        },
        activeCount: {
          $sum: {
            $cond: [{ $eq: ["$status", OUTSTANDING_LOAN_STATUS] }, 1, 0],
          },
        },

        delinquentCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", OUTSTANDING_LOAN_STATUS] },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$schedule", []] },
                            as: "installment",
                            cond: {
                              $and: [
                                { $ne: ["$$installment.paid", true] },
                                { $lt: ["$$installment.dueDate", now] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

const deductionTotal = (range) =>
  Deduction.aggregate([
    { $match: dateFilter("createdAt", range) },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ]);

const salaryTotal = (range) =>
  Payment.aggregate([
    {
      $match: {
        status: { $in: DISBURSED_PAYMENT_STATUSES },
        ...dateFilter("createdAt", range),
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$netAmount", 0] } } } },
  ]);

const headcountByStatus = () =>
  Mandoob.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

const headcountByCompany = () =>
  MandoobCompany.aggregate([
    {
      $lookup: {
        from: "mandoobs",
        localField: "mandoobId",
        foreignField: "_id",
        as: "mandoob",
      },
    },
    { $unwind: "$mandoob" },
    { $match: { "mandoob.status": "ACTIVE" } },
    { $group: { _id: "$companyId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "companies",
        localField: "_id",
        foreignField: "_id",
        as: "company",
      },
    },
    {
      $project: {
        _id: 0,
        companyId: { $toString: "$_id" },
        companyName: {
          $ifNull: [{ $arrayElemAt: ["$company.name", 0] }, null],
        },
        count: 1,
      },
    },
    { $sort: { count: -1, companyName: 1 } },
  ]);

const timeToFill = (range) =>
  Mandoob.aggregate([
    { $match: { status: "ACTIVE", ...dateFilter("createdAt", range) } },
    {
      $lookup: {
        from: "leads",
        localField: "phone",
        foreignField: "phone",
        as: "lead",
      },
    },
    { $unwind: "$lead" },
    {
      $lookup: {
        from: "calls",
        localField: "lead._id",
        foreignField: "leadId",
        as: "calls",
      },
    },

    {
      $group: {
        _id: "$_id",
        hiredAt: { $first: "$createdAt" },
        firstCallAt: { $min: { $min: "$calls.calledAt" } },
      },
    },
    { $match: { firstCallAt: { $ne: null } } },
    {
      $group: {
        _id: null,
        averageMillis: { $avg: { $subtract: ["$hiredAt", "$firstCallAt"] } },
      },
    },
  ]);

const agentCallTotals = (range) =>
  Call.aggregate([
    { $match: dateFilter("calledAt", range) },
    {
      $group: {
        _id: "$agentId",
        callVolume: { $sum: 1 },
        contacted: {
          $sum: { $cond: [{ $in: ["$outcome", CONTACTED_OUTCOMES] }, 1, 0] },
        },
        converted: {
          $sum: { $cond: [{ $eq: ["$outcome", CONVERTED_OUTCOME] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent",
      },
    },
    {
      $project: {
        _id: 0,
        agentId: { $toString: "$_id" },
        agentName: { $ifNull: [{ $arrayElemAt: ["$agent.fullName", 0] }, ""] },
        callVolume: 1,
        contacted: 1,
        converted: 1,
      },
    },
  ]);

const firstRow = (rows) => (Array.isArray(rows) && rows.length > 0 ? rows[0] : {});

const getDashboardSummary = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);

    if (range.details.length > 0) {
      return invalid(res, "Invalid date range", range.details);
    }

    const now = new Date();

    const [
      outcomeRows,
      loanRows,
      deductionRows,
      salaryRows,
      statusRows,
      companyRows,
      fillRows,
      blockedCount,
    ] = await Promise.all([
      callOutcomeCounts(range),
      loanTotals(now),
      deductionTotal(range),
      salaryTotal(range),
      headcountByStatus(),
      headcountByCompany(),
      timeToFill(range),
      BlockEntry.countDocuments({ active: true }),
    ]);

    const byOutcome = countMap(outcomeRows, CALL_OUTCOMES);

    const callVolume = CALL_OUTCOMES.reduce(
      (total, outcome) => total + byOutcome[outcome],
      0
    );

    const contactedCalls = CONTACTED_OUTCOMES.reduce(
      (total, outcome) => total + byOutcome[outcome],
      0
    );

    const loans = firstRow(loanRows);
    const employmentByStatus = countMap(statusRows, EMPLOYMENT_STATUSES);
    const fill = firstRow(fillRows);

    const averageMillis = Number(fill.averageMillis);
    const avgTimeToFillDays = Number.isFinite(averageMillis)
      ? round2(Math.max(averageMillis, 0) / MILLIS_PER_DAY)
      : 0;

    return res.status(200).json({
      callCenter: {
        conversionRate: percentage(byOutcome[CONVERTED_OUTCOME], contactedCalls),
        callVolume,
        byStatus: byOutcome,
      },
      finance: {
        loansOutstanding: round2(Number(loans.outstanding) || 0),
        loansRecovered: round2(Math.max(Number(loans.recovered) || 0, 0)),
        loanDelinquencyRate: percentage(
          Number(loans.delinquentCount) || 0,
          Number(loans.activeCount) || 0
        ),
        deductionsApplied: round2(Number(firstRow(deductionRows).total) || 0),
        salariesDisbursed: round2(Number(firstRow(salaryRows).total) || 0),
      },
      headcount: {
        activeEmployees: employmentByStatus.ACTIVE,
        byStatus: employmentByStatus,
        byCompany: companyRows,
      },
      avgTimeToFillDays,
      blockedCount,
    });
  } catch (error) {
    return next(error);
  }
};

const getAgentLeaderboard = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);

    if (range.details.length > 0) {
      return invalid(res, "Invalid date range", range.details);
    }

    const rows = await agentCallTotals(range);

    const leaderboard = rows.map((row) => ({
      agentId: row.agentId,
      agentName: row.agentName,

      conversionRate: percentage(row.converted, row.contacted),

      avgQualityScore: null,
      callVolume: row.callVolume,
    }));

    leaderboard.sort(
      (left, right) =>
        right.conversionRate - left.conversionRate ||
        right.callVolume - left.callVolume
    );

    return res.status(200).json(leaderboard);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getAgentLeaderboard,
};
