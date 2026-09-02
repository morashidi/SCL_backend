const mongoose = require("mongoose");
const { ROLES } = require("../utils/roles");

const STATUSES = ["active", "inactive", "deleted"];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ROLES,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
module.exports.STATUSES = STATUSES;
