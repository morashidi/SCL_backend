const notFound = (req, res) => {
  return res.status(404).json({
    code: "NOT_FOUND",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (error, req, res, next) => {

  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError" && error.errors) {
    return res.status(422).json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: Object.values(error.errors).map((fieldError) => ({
        field: fieldError.path,
        message: fieldError.message,
      })),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      code: "INVALID_ID",
      message: `Invalid value for ${error.path}`,
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];

    return res.status(409).json({
      code: "DUPLICATE_KEY",
      message: field
        ? `A record with that ${field} already exists`
        : "Duplicate value",
    });
  }

  if (error.name === "MulterError") {
    return res.status(422).json({
      code: "VALIDATION_ERROR",
      message: "Invalid file upload",
      details: [{ field: error.field || "file", message: error.message }],
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      code: "INVALID_JSON",
      message: "Request body is not valid JSON",
    });
  }

  const status = error.status || error.statusCode || 500;

  if (status >= 500) {
    console.error("Unhandled error:", error);
  }

  return res.status(status).json({
    code: error.code || "INTERNAL_ERROR",

    message: status >= 500 ? "Server error" : error.message || "Request failed",
  });
};

module.exports = {
  notFound,
  errorHandler,
};
