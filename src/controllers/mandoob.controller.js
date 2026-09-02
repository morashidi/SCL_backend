const mongoose = require("mongoose");
const Mandoob = require("../models/mandoob.model");
const {
  VEHICLE_TYPES,
  EMPLOYMENT_STATUSES,
  MANDOOB_KINDS,
} = require("../models/mandoob.model");
const MandoobCompany = require("../models/mandoobCompany.model");
const Company = require("../models/company.model");
const SalaryLine = require("../models/salaryLine.model");
const Loan = require("../models/loan.model");
const Deduction = require("../models/deduction.model");
const BlockEntry = require("../models/blockEntry.model");
const {
  toMandoob,
  toMandoobCompany,
  toSalaryLine,
  toLoan,
  toDeduction,
} = require("../utils/serializers");
const {
  parsePagination,
  paginated,
  escapeRegex,
} = require("../utils/pagination");
const { normalizePhone } = require("../utils/phone");

const notFound = (res, message = "Mandoob not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "DUPLICATE_KEY", message });

const blocked = (res, message) =>
  res.status(409).json({ code: "BLOCKED", message });

const MATCHES_NOTHING = { $in: [] };

const canAccessMandoob = (user, mandoob) =>
  user.role !== "mandoob" ||
  (mandoob.userId && mandoob.userId.toString() === user._id.toString());

const findMandoobById = async (mandoobId) => {
  if (!mongoose.isValidObjectId(mandoobId)) {
    return null;
  }

  return Mandoob.findById(mandoobId);
};

const readPayoutRecipient = (payoutRecipient) => ({
  recipientName: payoutRecipient.recipientName || "",
  accountOrWalletNumber: payoutRecipient.accountOrWalletNumber || "",
  isBigMandoob: Boolean(payoutRecipient.isBigMandoob),
});

const mergePayoutRecipient = (current, patch) => {
  const merged = readPayoutRecipient(current || {});

  if (patch.recipientName !== undefined) {
    merged.recipientName = patch.recipientName || "";
  }

  if (patch.accountOrWalletNumber !== undefined) {
    merged.accountOrWalletNumber = patch.accountOrWalletNumber || "";
  }

  if (patch.isBigMandoob !== undefined) {
    merged.isBigMandoob = Boolean(patch.isBigMandoob);
  }

  return merged;
};

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyStringArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === "string" && entry.trim() !== "");

const listMandoobs = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { status, companyId, city, search } = req.query;

    const filter = {};

    if (status) {

      filter.status = EMPLOYMENT_STATUSES.includes(status)
        ? status
        : MATCHES_NOTHING;
    }

    if (companyId) {

      const links = mongoose.isValidObjectId(companyId)
        ? await MandoobCompany.find({ companyId }).select("mandoobId")
        : [];

      filter._id = { $in: links.map((link) => link.mandoobId) };
    }

    if (city) {

      if (Array.isArray(city)) {
        const cityValues = city.filter(
          (entry) => typeof entry === "string" && entry.trim() !== ""
        );

        filter.cities = { $in: cityValues };
      } else {
        filter.cities = city;
      }
    }

    if (search) {

      const pattern = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { name: pattern },
        { phone: pattern },
        { nationalId: pattern },
      ];
    }

    const [total, mandoobs] = await Promise.all([
      Mandoob.countDocuments(filter),
      Mandoob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: mandoobs.map(toMandoob),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createMandoob = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      nationalId,
      licensePictureUrl,
      vehicleType,
      kind,
      cities,
      payoutRecipient,
    } = req.body || {};

    const details = [];

    if (!name) {
      details.push({ field: "name", message: "name is required" });
    }

    if (!phone) {
      details.push({ field: "phone", message: "phone is required" });
    }

    if (!nationalId) {
      details.push({ field: "nationalId", message: "nationalId is required" });
    }

    if (!vehicleType) {
      details.push({
        field: "vehicleType",
        message: "vehicleType is required",
      });
    } else if (!VEHICLE_TYPES.includes(vehicleType)) {
      details.push({
        field: "vehicleType",
        message: `must be one of ${VEHICLE_TYPES.join(", ")}`,
      });
    }

    if (!kind) {
      details.push({ field: "kind", message: "kind is required" });
    } else if (!MANDOOB_KINDS.includes(kind)) {
      details.push({
        field: "kind",
        message: `must be one of ${MANDOOB_KINDS.join(", ")}`,
      });
    }

    if (cities === undefined) {
      details.push({ field: "cities", message: "cities is required" });
    } else if (!isNonEmptyStringArray(cities)) {
      details.push({
        field: "cities",
        message: "must be a non-empty array of city names",
      });
    }

    if (payoutRecipient !== undefined && !isPlainObject(payoutRecipient)) {
      details.push({
        field: "payoutRecipient",
        message: "must be an object",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const normalizedPhone = normalizePhone(phone) || String(phone).trim();
    const normalizedNationalId = String(nationalId).trim();

    const blockEntry = await BlockEntry.findOne({
      active: true,
      $or: [{ phone: normalizedPhone }, { nationalId: normalizedNationalId }],
    });

    if (blockEntry) {
      return blocked(res, "Phone number or national ID is on the blocklist");
    }

    const mandoob = await Mandoob.create({
      name,
      phone: normalizedPhone,
      nationalId: normalizedNationalId,
      licensePictureUrl: licensePictureUrl || null,
      vehicleType,
      kind,
      cities,
      ...(payoutRecipient
        ? { payoutRecipient: readPayoutRecipient(payoutRecipient) }
        : {}),
    });

    return res.status(201).json(toMandoob(mandoob));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "A mandoob with this national ID already exists");
    }

    return next(error);
  }
};

const getMandoob = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    if (!canAccessMandoob(req.user, mandoob)) {
      return notFound(res);
    }

    return res.status(200).json(toMandoob(mandoob));
  } catch (error) {
    return next(error);
  }
};

const updateMandoob = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    const {
      name,
      licensePictureUrl,
      vehicleType,
      cities,
      status,
      payoutRecipient,
      phone,
      nationalId,
    } = req.body || {};

    const details = [];

    if (phone !== undefined) {
      details.push({
        field: "phone",
        message: "phone cannot be changed after creation",
      });
    }

    if (nationalId !== undefined) {
      details.push({
        field: "nationalId",
        message: "nationalId cannot be changed after creation",
      });
    }

    if (name !== undefined && !name) {
      details.push({ field: "name", message: "name cannot be empty" });
    }

    if (vehicleType !== undefined && !VEHICLE_TYPES.includes(vehicleType)) {
      details.push({
        field: "vehicleType",
        message: `must be one of ${VEHICLE_TYPES.join(", ")}`,
      });
    }

    if (cities !== undefined && !isNonEmptyStringArray(cities)) {
      details.push({
        field: "cities",
        message: "must be a non-empty array of city names",
      });
    }

    if (status !== undefined && !EMPLOYMENT_STATUSES.includes(status)) {
      details.push({
        field: "status",
        message: `must be one of ${EMPLOYMENT_STATUSES.join(", ")}`,
      });
    }

    if (payoutRecipient !== undefined && !isPlainObject(payoutRecipient)) {
      details.push({
        field: "payoutRecipient",
        message: "must be an object",
      });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    if (name !== undefined) {
      mandoob.name = name;
    }

    if (licensePictureUrl !== undefined) {
      mandoob.licensePictureUrl = licensePictureUrl || null;
    }

    if (vehicleType !== undefined) {
      mandoob.vehicleType = vehicleType;
    }

    if (cities !== undefined) {
      mandoob.cities = cities;
    }

    if (status !== undefined) {
      mandoob.status = status;
    }

    if (payoutRecipient !== undefined) {
      mandoob.payoutRecipient = mergePayoutRecipient(
        mandoob.payoutRecipient,
        payoutRecipient
      );
    }

    await mandoob.save();

    return res.status(200).json(toMandoob(mandoob));
  } catch (error) {
    return next(error);
  }
};

const findLinkForMandoob = async (mandoobId, linkId) => {
  if (!mongoose.isValidObjectId(linkId)) {
    return null;
  }

  return MandoobCompany.findOne({ _id: linkId, mandoobId });
};

const findCompanyById = async (companyId) => {
  if (!mongoose.isValidObjectId(companyId)) {
    return null;
  }

  return Company.findById(companyId);
};

const listMandoobCompanies = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    const links = await MandoobCompany.find({ mandoobId: mandoob._id }).sort({
      createdAt: -1,
    });

    const companyRefs = links.map((link) => link.companyId);

    await MandoobCompany.populate(links, { path: "companyId", select: "name" });

    links.forEach((link, index) => {
      if (!link.companyId) {
        link.companyId = companyRefs[index];
      }
    });

    return res.status(200).json(links.map(toMandoobCompany));
  } catch (error) {
    return next(error);
  }
};

const linkMandoobCompany = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    const { companyId, starId, username } = req.body || {};

    if (!companyId) {
      return invalid(res, "Invalid input", [
        { field: "companyId", message: "companyId is required" },
      ]);
    }

    const company = await findCompanyById(companyId);

    if (!company) {
      return notFound(res, "Company not found");
    }

    const link = await MandoobCompany.create({
      mandoobId: mandoob._id,
      companyId: company._id,
      starId: starId || null,
      username: username || null,
    });

    link.companyId = company;

    return res.status(201).json(toMandoobCompany(link));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "This company is already linked to the mandoob");
    }

    return next(error);
  }
};

const updateMandoobCompany = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    const link = await findLinkForMandoob(mandoob._id, req.params.linkId);

    if (!link) {
      return notFound(res, "Company link not found");
    }

    const { companyId, starId, username } = req.body || {};

    if (companyId !== undefined) {
      const company = await findCompanyById(companyId);

      if (!company) {
        return notFound(res, "Company not found");
      }

      link.companyId = company._id;
    }

    if (starId !== undefined) {
      link.starId = starId || null;
    }

    if (username !== undefined) {
      link.username = username || null;
    }

    await link.save();

    const companyRef = link.companyId;

    await link.populate("companyId", "name");

    if (!link.companyId) {
      link.companyId = companyRef;
    }

    return res.status(200).json(toMandoobCompany(link));
  } catch (error) {

    if (error.code === 11000) {
      return conflict(res, "This company is already linked to the mandoob");
    }

    return next(error);
  }
};

const unlinkMandoobCompany = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    const link = await findLinkForMandoob(mandoob._id, req.params.linkId);

    if (!link) {
      return notFound(res, "Company link not found");
    }

    await link.deleteOne();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const listMandoobSalaries = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    if (!canAccessMandoob(req.user, mandoob)) {
      return notFound(res);
    }

    const lines = await SalaryLine.find({ mandoobId: mandoob._id })
      .populate("companyId", "name")
      .sort({ period: -1, createdAt: -1 });

    return res.status(200).json(lines.map(toSalaryLine));
  } catch (error) {
    return next(error);
  }
};

const listMandoobLoans = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    if (!canAccessMandoob(req.user, mandoob)) {
      return notFound(res);
    }

    const loans = await Loan.find({ mandoobId: mandoob._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(loans.map(toLoan));
  } catch (error) {
    return next(error);
  }
};

const listMandoobDeductions = async (req, res, next) => {
  try {
    const mandoob = await findMandoobById(req.params.mandoobId);

    if (!mandoob) {
      return notFound(res);
    }

    if (!canAccessMandoob(req.user, mandoob)) {
      return notFound(res);
    }

    const deductions = await Deduction.find({ mandoobId: mandoob._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(deductions.map(toDeduction));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listMandoobs,
  createMandoob,
  getMandoob,
  updateMandoob,
  listMandoobCompanies,
  linkMandoobCompany,
  updateMandoobCompany,
  unlinkMandoobCompany,
  listMandoobSalaries,
  listMandoobLoans,
  listMandoobDeductions,
};
