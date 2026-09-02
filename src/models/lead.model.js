const mongoose = require("mongoose");

const CALL_OUTCOMES = [
  "INTERESTED",
  "NOT_INTERESTED",
  "NO_ANSWER",
  "DECLINED",
  "NOT_CALLED",
  "CALL_DROPPED",
  "NUMBER_UNREACHABLE",
  "INVALID_NUMBER",
  "REQUESTED_CALLBACK",
];

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: CALL_OUTCOMES,
      default: "NOT_CALLED",
      index: true,
    },

    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    rescheduledAt: {
      type: Date,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;
module.exports.CALL_OUTCOMES = CALL_OUTCOMES;
