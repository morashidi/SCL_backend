const mongoose = require("mongoose");

const geoZoneSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radiusMeters: { type: Number, default: 100 },
  },
  { _id: false }
);

const trainingSessionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    durationMinutes: {
      type: Number,
      default: null,
    },

    requiredStayMinutes: {
      type: Number,
      default: null,
    },

    zone: {
      type: geoZoneSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TrainingSession", trainingSessionSchema);
