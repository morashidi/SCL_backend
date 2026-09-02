const mongoose = require("mongoose");

const salaryLineSchema = new mongoose.Schema(
  {
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

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

    totalSalary: {
      type: Number,
      required: true,
    },

    source: {
      type: String,
      enum: ["IMPORT", "MANUAL"],
      default: "MANUAL",
    },
  },
  {
    timestamps: true,
  }
);

salaryLineSchema.index(
  { mandoobId: 1, companyId: 1, period: 1 },
  { unique: true }
);

module.exports = mongoose.model("SalaryLine", salaryLineSchema);
