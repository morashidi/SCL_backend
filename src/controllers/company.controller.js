const mongoose = require("mongoose");
const Company = require("../models/company.model");
const { toCompany } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Company not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const findCompanyById = async (companyId) => {
  if (!mongoose.isValidObjectId(companyId)) {
    return null;
  }

  return Company.findById(companyId);
};

const readName = (value) => {
  if (value === undefined || value === null || value === "") {
    return { error: "name is required" };
  }

  if (typeof value !== "string") {
    return { error: "must be a string" };
  }

  if (value.trim() === "") {
    return { error: "name is required" };
  }

  return { value: value.trim() };
};

const listCompanies = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [total, companies] = await Promise.all([
      Company.countDocuments({}),
      Company.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res
      .status(200)
      .json(paginated({ page, pageSize, total, items: companies.map(toCompany) }));
  } catch (error) {
    return next(error);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const { name } = req.body || {};

    const parsed = readName(name);

    if (parsed.error) {
      return invalid(res, "Invalid input", [
        { field: "name", message: parsed.error },
      ]);
    }

    const company = await Company.create({ name: parsed.value });

    return res.status(201).json(toCompany(company));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "A company with this name already exists");
    }

    return next(error);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const company = await findCompanyById(req.params.companyId);

    if (!company) {
      return notFound(res);
    }

    return res.status(200).json(toCompany(company));
  } catch (error) {
    return next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const company = await findCompanyById(req.params.companyId);

    if (!company) {
      return notFound(res);
    }

    const { name } = req.body || {};

    const parsed = readName(name);

    if (parsed.error) {
      return invalid(res, "Invalid input", [
        { field: "name", message: parsed.error },
      ]);
    }

    company.name = parsed.value;

    await company.save();

    return res.status(200).json(toCompany(company));
  } catch (error) {
    if (error.code === 11000) {
      return conflict(res, "A company with this name already exists");
    }

    return next(error);
  }
};

module.exports = {
  listCompanies,
  createCompany,
  getCompany,
  updateCompany,
};
