const mongoose = require("mongoose");

const blockEntrySchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    nationalId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    reason: {
      type: String,
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    unblockedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    unblockReason: { type: String, default: null },
    unblockedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BlockEntry", blockEntrySchema);
