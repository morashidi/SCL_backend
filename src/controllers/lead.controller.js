const mongoose = require("mongoose");
const Lead = require("../models/lead.model");
const { CALL_OUTCOMES } = require("../models/lead.model");
const User = require("../models/user.model");
const { toLead } = require("../utils/serializers");
const { normalizePhone } = require("../utils/phone");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Lead not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const MATCHES_NOTHING = { $in: [] };

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalString = (value) =>
  value === undefined || value === null || typeof value === "string";

const findLeadById = async (leadId) => {
  if (!mongoose.isValidObjectId(leadId)) {
    return null;
  }

  return Lead.findById(leadId);
};

const listLeads = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { status, assignedAgentId } = req.query;

    const filter = {};

    if (status) {

      filter.status = CALL_OUTCOMES.includes(status) ? status : MATCHES_NOTHING;
    }

    if (assignedAgentId) {
      filter.assignedAgentId = mongoose.isValidObjectId(assignedAgentId)
        ? assignedAgentId
        : MATCHES_NOTHING;
    }

    const [total, leads] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res
      .status(200)
      .json(paginated({ page, pageSize, total, items: leads.map(toLead) }));
  } catch (error) {
    return next(error);
  }
};

const createLeads = async (req, res, next) => {
  try {
    const { leads } = req.body || {};

    if (!Array.isArray(leads)) {
      return invalid(res, "Invalid input", [
        { field: "leads", message: "leads must be an array" },
      ]);
    }

    if (leads.length === 0) {
      return invalid(res, "Invalid input", [
        { field: "leads", message: "leads must contain at least one entry" },
      ]);
    }

    const details = [];

    leads.forEach((lead, index) => {
      if (!isPlainObject(lead)) {
        details.push({
          field: `leads[${index}]`,
          message: "must be an object",
        });

        return;
      }

      if (lead.phone === undefined || lead.phone === null) {
        details.push({
          field: `leads[${index}].phone`,
          message: "phone is required",
        });
      } else if (typeof lead.phone !== "string") {
        details.push({
          field: `leads[${index}].phone`,
          message: "must be a string",
        });
      } else if (lead.phone.trim() === "") {
        details.push({
          field: `leads[${index}].phone`,
          message: "phone is required",
        });
      }

      if (!isOptionalString(lead.name)) {
        details.push({
          field: `leads[${index}].name`,
          message: "must be a string",
        });
      }
    });

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const documents = [];

    leads.forEach((lead, index) => {
      const document = new Lead({
        name: lead.name || "",

        phone: normalizePhone(lead.phone),

        assignedAgentId: mongoose.isValidObjectId(lead.assignedAgentId)
          ? lead.assignedAgentId
          : null,
      });

      const error = document.validateSync();

      if (error) {
        Object.keys(error.errors).forEach((path) => {
          details.push({
            field: `leads[${index}].${path}`,
            message: error.errors[path].message,
          });
        });

        return;
      }

      documents.push(document);
    });

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const created = await Promise.all(
      documents.map((document) => document.save())
    );

    return res.status(201).json(created.map(toLead));
  } catch (error) {
    return next(error);
  }
};

const getLead = async (req, res, next) => {
  try {
    const lead = await findLeadById(req.params.leadId);

    if (!lead) {
      return notFound(res);
    }

    return res.status(200).json(toLead(lead));
  } catch (error) {
    return next(error);
  }
};

const rescheduleLead = async (req, res, next) => {
  try {
    const lead = await findLeadById(req.params.leadId);

    if (!lead) {
      return notFound(res);
    }

    const { scheduledAt, reassignToAgentId } = req.body || {};

    const details = [];

    if (!scheduledAt) {
      details.push({
        field: "scheduledAt",
        message: "scheduledAt is required",
      });
    } else if (

      typeof scheduledAt !== "string" ||
      Number.isNaN(new Date(scheduledAt).getTime())
    ) {
      details.push({
        field: "scheduledAt",
        message: "must be a valid date-time",
      });
    }

    if (
      reassignToAgentId !== undefined &&
      reassignToAgentId !== null &&
      !mongoose.isValidObjectId(reassignToAgentId)
    ) {
      details.push({
        field: "reassignToAgentId",
        message: "must be a valid id",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    let agent = null;

    if (reassignToAgentId) {

      agent = await User.findOne({
        _id: reassignToAgentId,
        status: { $ne: "deleted" },
      });

      if (!agent) {
        return notFound(res, "Agent not found");
      }
    }

    lead.rescheduledAt = new Date(scheduledAt);

    if (agent) {
      lead.assignedAgentId = agent._id;
    }

    await lead.save();

    return res.status(200).json(toLead(lead));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listLeads,
  createLeads,
  getLead,
  rescheduleLead,
};
