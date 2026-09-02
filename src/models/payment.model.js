const mongoose = require("mongoose");

const PAYMENT_METHODS = [
  "CASH",
  "VODAFONE_CASH",
  "BANK_TRANSFER",
  "PAYOUT_API",
];

const PAYMENT_STATUSES = ["RECORDED", "PENDING", "PAID", "FAILED"];

const recipientSchema = new mongoose.Schema(
  {
    recipientName: { type: String, trim: true, default: "" },
    accountOrWalletNumber: { type: String, trim: true, default: "" },
    isBigMandoob: { type: Boolean, default: false },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

    period: {
      type: String,
      required: true,
      index: true,
    },

    grossAmount: { type: Number, required: true },
    deductionsAmount: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },

    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "RECORDED",
      index: true,
    },

    recipient: {
      type: recipientSchema,
      default: () => ({}),
    },

    screenshotUrl: { type: String, default: null },

    paidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ mandoobId: 1, period: 1 }, { unique: true });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
