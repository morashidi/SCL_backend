const mongoose = require("mongoose");

const LOAN_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CLOSED"];

const installmentSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    paid: { type: Boolean, default: false },
  },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

    principal: { type: Number, required: true },
    installmentAmount: { type: Number, required: true },
    installmentsCount: { type: Number, required: true },
    installmentsPaid: { type: Number, default: 0 },
    remainingBalance: { type: Number, required: true },

    status: {
      type: String,
      enum: LOAN_STATUSES,
      default: "PENDING",
      index: true,
    },

    eligible: { type: Boolean, default: true },
    exceptionApproved: { type: Boolean, default: false },

    decisionByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decisionReason: { type: String, default: null },

    schedule: {
      type: [installmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Loan = mongoose.model("Loan", loanSchema);

module.exports = Loan;
module.exports.LOAN_STATUSES = LOAN_STATUSES;
