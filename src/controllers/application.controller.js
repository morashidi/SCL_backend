const Application = require("../models/application.model");

// This endpoint is not part of openapi-1.yaml and is the only unauthenticated
// write in the system. It is kept working for whatever intake form still posts
// to it, but its failures now use the same Error envelope as everything else
// and reach the shared handler rather than being swallowed here.
const createApplication = async (req, res, next) => {
  try {
    // express.json() leaves req.body undefined for a non-JSON content type, so
    // destructuring it directly turned an anonymous request into a 500.
    const { firstName, lastName, phoneNumber, nationalId, address } =
      req.body || {};

    const details = [];

    if (!firstName) {
      details.push({ field: "firstName", message: "firstName is required" });
    }

    if (!lastName) {
      details.push({ field: "lastName", message: "lastName is required" });
    }

    if (!phoneNumber) {
      details.push({
        field: "phoneNumber",
        message: "phoneNumber is required",
      });
    }

    if (!nationalId) {
      details.push({ field: "nationalId", message: "nationalId is required" });
    }

    if (!address) {
      details.push({ field: "address", message: "address is required" });
    }

    if (details.length > 0) {
      return res.status(422).json({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details,
      });
    }

    const application = await Application.create({
      firstName,
      lastName,
      phoneNumber,
      nationalId,
      address,
    });

    return res.status(201).json({
      id: application._id.toString(),
      firstName: application.firstName,
      lastName: application.lastName,
      phoneNumber: application.phoneNumber,
      nationalId: application.nationalId,
      address: application.address,
      createdAt: application.createdAt
        ? new Date(application.createdAt).toISOString()
        : null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createApplication,
};
