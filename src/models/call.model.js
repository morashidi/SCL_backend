const mongoose = require("mongoose");
const { CALL_OUTCOMES } = require("./lead.model");

const callSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    outcome: {
      type: String,
      enum: CALL_OUTCOMES,
      required: true,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    recordingUrl: {
      type: String,
      default: null,
    },

    calledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Call", callSchema);
