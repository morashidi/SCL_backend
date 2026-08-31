const mongoose = require("mongoose");

const MandoobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    nationalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    area: {
      type: String,
      default: "",
      trim: true,
    },

    employmentStatus: {
      type: String,
      enum: [
        "ACTIVE",
        "INACTIVE",
        "SUSPENDED",
        "TERMINATED",
      ],
      default: "ACTIVE",
    },

    vehicleType: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleNumber: {
      type: String,
      default: "",
      trim: true,
    },

    starId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Mandoob", MandoobSchema);