const mongoose = require("mongoose");

const CallSchema = new mongoose.Schema(
  {
    caller: {
      type: String,
      required: true,
      trim: true,
    },

    callee: {
      type: String,
      required: true,
      trim: true,
    },

    text: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["answered", "declined", "not_answered", "pending"],
      default: "pending",
    },

    audio: {
      type: String,
      default: null,
      //required: null,    (لازم اس
    },

    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Call", CallSchema);