const mongoose = require("mongoose");

const mandoobCompanySchema = new mongoose.Schema(
  {
    mandoobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandoob",
      required: true,
      index: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    starId: {
      type: String,
      trim: true,
      default: null,
    },

    username: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

mandoobCompanySchema.index({ mandoobId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("MandoobCompany", mandoobCompanySchema);
