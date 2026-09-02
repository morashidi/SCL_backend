const mongoose = require("mongoose");

const DEDUCTION_TYPES = ["LOAN_REPAYMENT", "DAMAGE", "LOSS"];

const deductionSchema = new mongoose.Schema(
  {
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: DEDUCTION_TYPES,
      required: true,
      index: true,
    },

    amount: { type: Number, required: true },

    reason: { type: String, default: "" },

    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      default: null,
    },

    recordedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Deduction = mongoose.model("Deduction", deductionSchema);

module.exports = Deduction;
module.exports.DEDUCTION_TYPES = DEDUCTION_TYPES;
