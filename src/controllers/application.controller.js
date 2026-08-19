const Application = require("../models/application.model");

const createApplication = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      nationalId,
      address,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !nationalId ||
      !address
    ) {
      return res.status(400).json({
        message: "All application fields are required",
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
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Create application error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createApplication,
};
