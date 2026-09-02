const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Call = require("../models/call.model");
const Lead = require("../models/lead.model");
const { CALL_OUTCOMES } = require("../models/lead.model");
const BlockEntry = require("../models/blockEntry.model");
const { parsePagination, paginated } = require("../utils/pagination");
const { toCall } = require("../utils/serializers");
const { normalizePhone } = require("../utils/phone");

const MATCHES_NOTHING = { $in: [] };

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

const notFound = (res, message = "Call not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const blocked = (res, message) =>
  res.status(409).json({ code: "BLOCKED", message });

const listCalls = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { agentId, leadId, outcome } = req.query;

    const filter = {};

    if (agentId) {
      filter.agentId = mongoose.isValidObjectId(agentId)
        ? agentId
        : MATCHES_NOTHING;
    }

    if (leadId) {
      filter.leadId = mongoose.isValidObjectId(leadId) ? leadId : MATCHES_NOTHING;
    }

    if (outcome) {
      filter.outcome = CALL_OUTCOMES.includes(outcome) ? outcome : MATCHES_NOTHING;
    }

    const [total, calls] = await Promise.all([
      Call.countDocuments(filter),
      Call.find(filter).sort({ calledAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: calls.map(toCall),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createCall = async (req, res, next) => {
  try {
    const { leadId, outcome, note } = req.body || {};

    const details = [];

    if (!leadId) {
      details.push({ field: "leadId", message: "leadId is required" });
    } else if (!mongoose.isValidObjectId(leadId)) {
      details.push({ field: "leadId", message: "must be a valid id" });
    }

    if (!outcome) {
      details.push({ field: "outcome", message: "outcome is required" });
    } else if (!CALL_OUTCOMES.includes(outcome)) {
      details.push({
        field: "outcome",
        message: `must be one of ${CALL_OUTCOMES.join(", ")}`,
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return notFound(res, "Lead not found");
    }

    const blockEntry = await BlockEntry.findOne({
      phone: normalizePhone(lead.phone),
      active: true,
    });

    if (blockEntry) {
      return blocked(res, "Lead phone number is blocked");
    }

    lead.status = outcome;

    if (note) {
      lead.note = note;
    }

    await lead.save();

    const call = await Call.create({
      leadId: lead._id,
      agentId: req.user._id,
      outcome,
      note: note || "",
    });

    return res.status(201).json(toCall(call));
  } catch (error) {
    return next(error);
  }
};

const getCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    if (!mongoose.isValidObjectId(callId)) {
      return notFound(res);
    }

    const call = await Call.findById(callId);

    if (!call) {
      return notFound(res);
    }

    return res.status(200).json(toCall(call));
  } catch (error) {
    return next(error);
  }
};

const uploadCallRecording = async (req, res, next) => {
  try {
    const { callId } = req.params;

    if (!mongoose.isValidObjectId(callId)) {
      return notFound(res);
    }

    if (!req.file) {
      return invalid(res, "Invalid input", [
        { field: "file", message: "file is required" },
      ]);
    }

    const call = await Call.findById(callId);

    if (!call) {
      return notFound(res);
    }

    call.recordingUrl = `/uploads/${req.file.filename}`;
    await call.save();

    return res.status(201).json({ recordingUrl: call.recordingUrl });
  } catch (error) {
    return next(error);
  }
};

const getCallRecording = async (req, res, next) => {
  try {
    const { callId } = req.params;

    if (!mongoose.isValidObjectId(callId)) {
      return notFound(res);
    }

    const call = await Call.findById(callId);

    if (!call || !call.recordingUrl) {
      return notFound(res, "Recording not found");
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(call.recordingUrl));

    if (!fs.existsSync(filePath)) {
      return notFound(res, "Recording not found");
    }

    res.type("audio/mpeg");

    return res.sendFile(filePath);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listCalls,
  createCall,
  getCall,
  uploadCallRecording,
  getCallRecording,
};
