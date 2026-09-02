const mongoose = require("mongoose");

const trainingAssignmentSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSession",
      required: true,
      index: true,
    },

    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

    attended: {
      type: Boolean,
      default: false,
    },

    attendedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

trainingAssignmentSchema.index({ sessionId: 1, mandoobId: 1 }, { unique: true });

module.exports = mongoose.model(
  "TrainingAssignment",
  trainingAssignmentSchema
);
