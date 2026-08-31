const Mandoob = require("../models/mandoob.model");
const User = require("../models/user.model");

const createMandoobProfile = async (req, res, next) => {
  try {
    const {
      userId,
      fullName,
      phone,
      nationalId,
      city,
      area,
      vehicleType,
      vehicleNumber,
      starId,
      username,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "delivery_man") {
      return res.status(400).json({
        success: false,
        message: "User is not a delivery_man",
      });
    }

    const existingProfile = await Mandoob.findOne({
      user: userId,
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "Mandoob profile already exists",
      });
    }

    const mandoob = await Mandoob.create({
      user: userId,
      fullName,
      phone,
      nationalId,
      city,
      area,
      vehicleType,
      vehicleNumber,
      starId,
      username,
    });

    res.status(201).json({
      success: true,
      message: "Mandoob profile created successfully",
      data: mandoob,
    });
  } catch (error) {
    next(error);
  }
};


const getMandoobProfile = async (req, res, next) => {
  try {
    const mandoob = await Mandoob.findOne({
      user: req.params.userId,
    }).populate("user", "username role");

    if (!mandoob) {
      return res.status(404).json({
        success: false,
        message: "Mandoob profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: mandoob,
    });
  } catch (error) {
    next(error);
  }
};


const updateMandoobProfile = async (req, res, next) => {
  try {
    const mandoob = await Mandoob.findOneAndUpdate(
      {
        user: req.params.userId,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!mandoob) {
      return res.status(404).json({
        success: false,
        message: "Mandoob profile not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mandoob profile updated successfully",
      data: mandoob,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createMandoobProfile,
  getMandoobProfile,
  updateMandoobProfile,
}