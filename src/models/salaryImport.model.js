const mongoose = require("mongoose");

const IMPORT_STATUSES = ["PENDING_REVIEW", "COMMITTED"];
const ISSUE_TYPES = ["UNMATCHED_ID", "DUPLICATE_ROW", "MISSING_FIELD"];

const issueSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    type: { type: String, enum: ISSUE_TYPES, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

const stagedRowSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
    },
    starId: { type: String, default: null },
    totalSalary: { type: Number, required: true },
  },
  { _id: false }
);

const salaryImportSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    period: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: IMPORT_STATUSES,
      default: "PENDING_REVIEW",
      index: true,
    },

    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },

    issues: {
      type: [issueSchema],
      default: [],
    },

    rows: {
      type: [stagedRowSchema],
      default: [],
    },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    committedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

const SalaryImport = mongoose.model("SalaryImport", salaryImportSchema);

module.exports = SalaryImport;
module.exports.IMPORT_STATUSES = IMPORT_STATUSES;
module.exports.ISSUE_TYPES = ISSUE_TYPES;
