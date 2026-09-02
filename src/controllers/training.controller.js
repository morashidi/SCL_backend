const mongoose = require("mongoose");
const TrainingSession = require("../models/trainingSession.model");
const TrainingAssignment = require("../models/trainingAssignment.model");
const Company = require("../models/company.model");
const Mandoob = require("../models/mandoob.model");
const {
  toTrainingSession,
  toTrainingAssignment,
} = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Training session not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const MATCHES_NOTHING = { $in: [] };

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

const isPositiveInteger = (value) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const findSessionById = async (sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) {
    return null;
  }

  return TrainingSession.findById(sessionId);
};

const readGeoZone = (zone) => ({
  latitude: zone.latitude,
  longitude: zone.longitude,
  ...(zone.radiusMeters === undefined ? {} : { radiusMeters: zone.radiusMeters }),
});

const validateGeoZone = (zone, details) => {
  if (!isPlainObject(zone)) {
    details.push({ field: "zone", message: "must be an object" });
    return;
  }

  if (!isNumber(zone.latitude)) {
    details.push({
      field: "zone.latitude",
      message: "latitude is required and must be a number",
    });
  } else if (zone.latitude < -90 || zone.latitude > 90) {
    details.push({
      field: "zone.latitude",
      message: "must be between -90 and 90",
    });
  }

  if (!isNumber(zone.longitude)) {
    details.push({
      field: "zone.longitude",
      message: "longitude is required and must be a number",
    });
  } else if (zone.longitude < -180 || zone.longitude > 180) {
    details.push({
      field: "zone.longitude",
      message: "must be between -180 and 180",
    });
  }

  if (zone.radiusMeters !== undefined && !isPositiveInteger(zone.radiusMeters)) {
    details.push({
      field: "zone.radiusMeters",
      message: "must be a positive integer",
    });
  }
};

const listTrainingSessions = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { companyId } = req.query;

    const filter = {};

    if (companyId) {

      filter.companyId = mongoose.isValidObjectId(companyId)
        ? companyId
        : MATCHES_NOTHING;
    }

    const [total, sessions] = await Promise.all([
      TrainingSession.countDocuments(filter),
      TrainingSession.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: sessions.map(toTrainingSession),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createTrainingSession = async (req, res, next) => {
  try {
    const { companyId, scheduledAt, durationMinutes, requiredStayMinutes, zone } =
      req.body || {};

    const details = [];

    if (!companyId) {
      details.push({ field: "companyId", message: "companyId is required" });
    }

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

    if (zone === undefined) {
      details.push({ field: "zone", message: "zone is required" });
    } else {
      validateGeoZone(zone, details);
    }

    if (durationMinutes !== undefined && !isPositiveInteger(durationMinutes)) {
      details.push({
        field: "durationMinutes",
        message: "must be a positive integer",
      });
    }

    if (
      requiredStayMinutes !== undefined &&
      !isPositiveInteger(requiredStayMinutes)
    ) {
      details.push({
        field: "requiredStayMinutes",
        message: "must be a positive integer",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const company = mongoose.isValidObjectId(companyId)
      ? await Company.findById(companyId)
      : null;

    if (!company) {
      return notFound(res, "Company not found");
    }

    const session = await TrainingSession.create({
      companyId: company._id,
      scheduledAt: new Date(scheduledAt),
      durationMinutes:
        durationMinutes === undefined ? null : durationMinutes,

      requiredStayMinutes:
        requiredStayMinutes === undefined ? null : requiredStayMinutes,
      zone: readGeoZone(zone),
    });

    return res.status(201).json(toTrainingSession(session));
  } catch (error) {
    return next(error);
  }
};

const getTrainingSession = async (req, res, next) => {
  try {
    const session = await findSessionById(req.params.sessionId);

    if (!session) {
      return notFound(res);
    }

    return res.status(200).json(toTrainingSession(session));
  } catch (error) {
    return next(error);
  }
};

const listTrainingAssignments = async (req, res, next) => {
  try {
    const session = await findSessionById(req.params.sessionId);

    if (!session) {
      return notFound(res);
    }

    const assignments = await TrainingAssignment.find({
      sessionId: session._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json(assignments.map(toTrainingAssignment));
  } catch (error) {
    return next(error);
  }
};

const assignMandoobToSession = async (req, res, next) => {
  try {
    const session = await findSessionById(req.params.sessionId);

    if (!session) {
      return notFound(res);
    }

    const { mandoobId } = req.body || {};

    if (!mandoobId) {
      return invalid(res, "Invalid input", [
        { field: "mandoobId", message: "mandoobId is required" },
      ]);
    }

    const mandoob = mongoose.isValidObjectId(mandoobId)
      ? await Mandoob.findById(mandoobId)
      : null;

    if (!mandoob) {
      return notFound(res, "Mandoob not found");
    }

    const assignment = await TrainingAssignment.create({
      sessionId: session._id,
      mandoobId: mandoob._id,
    });

    return res.status(201).json(toTrainingAssignment(assignment));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "This mandoob is already assigned to the session");
    }

    return next(error);
  }
};

module.exports = {
  listTrainingSessions,
  createTrainingSession,
  getTrainingSession,
  listTrainingAssignments,
  assignMandoobToSession,
};
