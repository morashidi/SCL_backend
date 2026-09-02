const mongoose = require("mongoose");

const VEHICLE_TYPES = ["BICYCLE", "SMALL_PICKUP", "LARGE_PICKUP"];
const EMPLOYMENT_STATUSES = ["ACTIVE", "INACTIVE"];
const MANDOOB_KINDS = ["MANDOOB", "DRIVER"];

const payoutRecipientSchema = new mongoose.Schema(
  {
    recipientName: { type: String, trim: true, default: "" },
    accountOrWalletNumber: { type: String, trim: true, default: "" },
    isBigMandoob: { type: Boolean, default: false },
  },
  { _id: false }
);

const mandoobSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    nationalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    licensePictureUrl: {
      type: String,
      default: null,
    },

    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      required: true,
    },

    kind: {
      type: String,
      enum: MANDOOB_KINDS,
      required: true,
    },

    cities: {
      type: [String],
      default: [],
      index: true,
    },

    status: {
      type: String,
      enum: EMPLOYMENT_STATUSES,
      default: "ACTIVE",
      index: true,
    },

    deactivationReason: {
      type: String,
      default: null,
    },

    payoutRecipient: {
      type: payoutRecipientSchema,
      default: () => ({}),
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Mandoob = mongoose.model("Mandoob", mandoobSchema);

module.exports = Mandoob;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
module.exports.EMPLOYMENT_STATUSES = EMPLOYMENT_STATUSES;
module.exports.MANDOOB_KINDS = MANDOOB_KINDS;
