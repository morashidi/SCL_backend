const mongoose = require("mongoose");
const BlockEntry = require("../models/blockEntry.model");
const { toBlockEntry } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");
const { normalizePhone } = require("../utils/phone");

const notFound = (res, message = "Block entry not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const MATCHES_NOTHING = { $in: [] };

const readString = (value) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const findEntryById = async (entryId) => {
  if (!mongoose.isValidObjectId(entryId)) {
    return null;
  }

  return BlockEntry.findById(entryId);
};

const requiredReason = (reason) => {
  if (reason === undefined || reason === null || reason === "") {
    return { field: "reason", message: "reason is required" };
  }

  if (typeof reason !== "string") {
    return { field: "reason", message: "must be a string" };
  }

  if (reason.trim() === "") {
    return { field: "reason", message: "reason is required" };
  }

  return null;
};

const listBlockEntries = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { active } = req.query;

    const filter = {};

    if (active !== undefined && active !== "") {
      if (active === "true") {
        filter.active = true;
      } else if (active === "false") {
        filter.active = false;
      } else {

        filter.active = MATCHES_NOTHING;
      }
    }

    const [total, entries] = await Promise.all([
      BlockEntry.countDocuments(filter),
      BlockEntry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: entries.map(toBlockEntry),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createBlockEntry = async (req, res, next) => {
  try {
    const { phone, nationalId, reason } = req.body || {};

    const details = [];

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      details.push({ field: "phone", message: "must be a string" });
    }

    if (
      nationalId !== undefined &&
      nationalId !== null &&
      typeof nationalId !== "string"
    ) {
      details.push({ field: "nationalId", message: "must be a string" });
    }

    const reasonError = requiredReason(reason);

    if (reasonError) {
      details.push(reasonError);
    }

    const rawPhone = readString(phone);
    const rawNationalId = readString(nationalId);

    if (!rawPhone && !rawNationalId) {
      details.push({
        field: "phone",
        message: "at least one of phone or nationalId is required",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const entry = await BlockEntry.create({
      phone: rawPhone ? normalizePhone(rawPhone) || rawPhone : null,
      nationalId: rawNationalId,
      reason: reason.trim(),
      active: true,

      createdByUserId: req.user._id,
    });

    return res.status(201).json(toBlockEntry(entry));
  } catch (error) {
    return next(error);
  }
};

const checkBlocklist = async (req, res, next) => {
  try {
    const phone = readString(req.query.phone);
    const nationalId = readString(req.query.nationalId);

    if (!phone && !nationalId) {
      return invalid(res, "Invalid input", [
        {
          field: "phone",
          message: "at least one of phone or nationalId is required",
        },
      ]);
    }

    const conditions = [];

    if (phone) {

      conditions.push({ phone: normalizePhone(phone) || phone });
    }

    if (nationalId) {
      conditions.push({ nationalId });
    }

    const entry = await BlockEntry.findOne({
      active: true,
      $or: conditions,
    }).sort({ createdAt: -1 });

    if (!entry) {
      return res.status(200).json({ blocked: false });
    }

    return res.status(200).json({ blocked: true, entry: toBlockEntry(entry) });
  } catch (error) {
    return next(error);
  }
};

const unblockEntry = async (req, res, next) => {
  try {
    const entry = await findEntryById(req.params.entryId);

    if (!entry) {
      return notFound(res);
    }

    const reasonError = requiredReason((req.body || {}).reason);

    if (reasonError) {
      return invalid(res, "Invalid input", [reasonError]);
    }

    if (!entry.active) {
      return res.status(409).json({
        code: "ALREADY_UNBLOCKED",
        message: "This entry has already been unblocked",
      });
    }

    entry.active = false;
    entry.unblockedByUserId = req.user._id;
    entry.unblockReason = req.body.reason.trim();
    entry.unblockedAt = new Date();

    await entry.save();

    return res.status(200).json(toBlockEntry(entry));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listBlockEntries,
  createBlockEntry,
  checkBlocklist,
  unblockEntry,
};
