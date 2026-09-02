const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const SalaryImport = require("../models/salaryImport.model");
const SalaryLine = require("../models/salaryLine.model");
const Mandoob = require("../models/mandoob.model");
const MandoobCompany = require("../models/mandoobCompany.model");
const Company = require("../models/company.model");
const { toSalaryImport, toSalaryLine } = require("../utils/serializers");
const { parsePagination, paginated } = require("../utils/pagination");

const notFound = (res, message = "Salary import not found") =>
  res.status(404).json({ code: "NOT_FOUND", message });

const invalid = (res, message, details) =>
  res.status(422).json({
    code: "VALIDATION_ERROR",
    message,
    ...(details && details.length > 0 ? { details } : {}),
  });

const conflict = (res, message) =>
  res.status(409).json({ code: "CONFLICT", message });

const MATCHES_NOTHING = { $in: [] };

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const findImportById = async (importId) => {
  if (!mongoose.isValidObjectId(importId)) {
    return null;
  }

  return SalaryImport.findById(importId);
};

const findCompanyById = async (companyId) => {
  if (!mongoose.isValidObjectId(companyId)) {
    return null;
  }

  return Company.findById(companyId);
};

const findMandoobById = async (mandoobId) => {
  if (!mongoose.isValidObjectId(mandoobId)) {
    return null;
  }

  return Mandoob.findById(mandoobId);
};

const roundMoney = (value) => Math.round(value * 100) / 100;

const STAR_ID_HEADERS = ["starid"];
const NATIONAL_ID_HEADERS = ["nationalid"];
const AMOUNT_HEADERS = ["totalsalary", "salary"];

const normalizeHeader = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const cellText = (cell) => {
  if (!cell) {
    return "";
  }

  const value = cell.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }

    if (value.result !== undefined && value.result !== null) {
      return typeof value.result === "object" ? "" : String(value.result);
    }

    if (value.text !== undefined && value.text !== null) {
      return String(value.text);
    }

    return "";
  }

  return String(value);
};

const isBlankRow = (row) => {
  let blank = true;

  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellText(cell).trim() !== "") {
      blank = false;
    }
  });

  return blank;
};

const parseAmount = (text) => {
  const cleaned = text.replace(/[\s,]/g, "");

  if (cleaned === "") {
    return null;
  }

  const amount = Number(cleaned);

  return Number.isFinite(amount) ? roundMoney(amount) : null;
};

const removeUploadedFile = (file) => {
  if (!file || !file.path) {
    return;
  }

  fs.unlink(file.path, () => {

  });
};

const readWorkbook = async (filePath) => {
  const workbook = new ExcelJS.Workbook();

  if (path.extname(filePath).toLowerCase() === ".csv") {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  return workbook;
};

const listSalaryImports = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [total, batches] = await Promise.all([
      SalaryImport.countDocuments({}),
      SalaryImport.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: batches.map(toSalaryImport),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createSalaryImport = async (req, res, next) => {
  try {
    const { companyId, period } = req.body || {};
    const details = [];

    if (!req.file) {
      details.push({ field: "file", message: "file is required" });
    }

    if (!companyId) {
      details.push({ field: "companyId", message: "companyId is required" });
    }

    if (!period) {
      details.push({ field: "period", message: "period is required" });
    } else if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
      details.push({ field: "period", message: "must be in YYYY-MM format" });
    }

    if (details.length > 0) {
      removeUploadedFile(req.file);

      return invalid(res, "Invalid input", details);
    }

    const company = await findCompanyById(companyId);

    if (!company) {
      removeUploadedFile(req.file);

      return notFound(res, "Company not found");
    }

    let workbook;

    try {
      workbook = await readWorkbook(req.file.path);
    } catch (parseError) {
      removeUploadedFile(req.file);

      return invalid(res, "Invalid input", [
        { field: "file", message: "file could not be read as a spreadsheet" },
      ]);
    }

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      removeUploadedFile(req.file);

      return invalid(res, "Invalid input", [
        { field: "file", message: "workbook contains no worksheet" },
      ]);
    }

    const headerRow = worksheet.getRow(1);
    const columns = {};

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = normalizeHeader(cellText(cell).trim());

      if (STAR_ID_HEADERS.includes(header) && !columns.starId) {
        columns.starId = colNumber;
      } else if (NATIONAL_ID_HEADERS.includes(header) && !columns.nationalId) {
        columns.nationalId = colNumber;
      } else if (AMOUNT_HEADERS.includes(header) && !columns.amount) {
        columns.amount = colNumber;
      }
    });

    const headerDetails = [];

    if (!columns.starId && !columns.nationalId) {
      headerDetails.push({
        field: "file",
        message: "missing a starId or nationalId column",
      });
    }

    if (!columns.amount) {
      headerDetails.push({
        field: "file",
        message: "missing a totalSalary or salary column",
      });
    }

    if (headerDetails.length > 0) {
      removeUploadedFile(req.file);

      return invalid(res, "Invalid input", headerDetails);
    }

    const parsedRows = [];
    const starIds = new Set();
    const nationalIds = new Set();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (isBlankRow(row)) {
        continue;
      }

      const starId = columns.starId
        ? cellText(row.getCell(columns.starId)).trim()
        : "";

      const nationalId = columns.nationalId
        ? cellText(row.getCell(columns.nationalId)).trim()
        : "";

      const amount = parseAmount(cellText(row.getCell(columns.amount)).trim());

      const parsed = { row: rowNumber, starId, nationalId, amount };

      if ((!starId && !nationalId) || amount === null) {
        parsed.missing = !starId && !nationalId ? "identifier" : "totalSalary";
      } else if (starId) {
        starIds.add(starId.toLowerCase());
      } else {
        nationalIds.add(nationalId);
      }

      parsedRows.push(parsed);
    }

    const starIdToMandoobId = new Map();

    if (starIds.size > 0) {
      const links = await MandoobCompany.find({
        companyId: company._id,
        starId: { $nin: [null, ""] },
      }).select("mandoobId starId");

      links.forEach((link) => {
        const key = String(link.starId).trim().toLowerCase();

        if (key !== "" && !starIdToMandoobId.has(key)) {
          starIdToMandoobId.set(key, link.mandoobId);
        }
      });
    }

    const nationalIdToMandoobId = new Map();

    if (nationalIds.size > 0) {
      const mandoobs = await Mandoob.find({
        nationalId: { $in: [...nationalIds] },
      }).select("nationalId");

      mandoobs.forEach((mandoob) => {
        nationalIdToMandoobId.set(String(mandoob.nationalId).trim(), mandoob._id);
      });
    }

    const issues = [];
    const stagedRows = [];
    const seenMandoobIds = new Map();

    parsedRows.forEach((parsed) => {
      if (parsed.missing) {
        issues.push({
          row: parsed.row,
          type: "MISSING_FIELD",
          message:
            parsed.missing === "identifier"
              ? "row has no starId or nationalId"
              : "row has a missing or non-numeric salary amount",
        });

        return;
      }

      const usedStarId = Boolean(parsed.starId);

      const mandoobId = usedStarId
        ? starIdToMandoobId.get(parsed.starId.toLowerCase())
        : nationalIdToMandoobId.get(parsed.nationalId);

      if (!mandoobId) {
        issues.push({
          row: parsed.row,
          type: "UNMATCHED_ID",
          message: usedStarId
            ? `no mandoob at this company carries starId "${parsed.starId}"`
            : `no mandoob carries nationalId "${parsed.nationalId}"`,
        });

        return;
      }

      const key = mandoobId.toString();
      const firstRow = seenMandoobIds.get(key);

      if (firstRow !== undefined) {
        issues.push({
          row: parsed.row,
          type: "DUPLICATE_ROW",
          message: `this mandoob already appears on row ${firstRow}`,
        });

        return;
      }

      seenMandoobIds.set(key, parsed.row);

      stagedRows.push({
        row: parsed.row,
        mandoobId,
        starId: usedStarId ? parsed.starId : null,
        totalSalary: parsed.amount,
      });
    });

    removeUploadedFile(req.file);

    const batch = await SalaryImport.create({
      companyId: company._id,
      period,
      status: "PENDING_REVIEW",
      totalRows: parsedRows.length,
      validRows: stagedRows.length,
      issues,

      rows: stagedRows,
      createdByUserId: req.user ? req.user._id : null,
    });

    return res.status(201).json(toSalaryImport(batch));
  } catch (error) {
    removeUploadedFile(req.file);

    return next(error);
  }
};

const getSalaryImport = async (req, res, next) => {
  try {
    const batch = await findImportById(req.params.importId);

    if (!batch) {
      return notFound(res);
    }

    return res.status(200).json(toSalaryImport(batch));
  } catch (error) {
    return next(error);
  }
};

const commitSalaryImport = async (req, res, next) => {
  try {
    const batch = await findImportById(req.params.importId);

    if (!batch) {
      return notFound(res);
    }

    if (batch.status === "COMMITTED") {
      return conflict(res, "Import batch has already been committed");
    }

    if (batch.issues.length > 0) {
      return conflict(
        res,
        "Batch has blocking validation errors and cannot be committed"
      );
    }

    const lines = await SalaryLine.insertMany(
      batch.rows.map((staged) => ({
        mandoobId: staged.mandoobId,
        companyId: batch.companyId,
        period: batch.period,
        totalSalary: staged.totalSalary,
        source: "IMPORT",
      }))
    );

    const committed = await SalaryImport.findOneAndUpdate(
      { _id: batch._id, status: "PENDING_REVIEW" },
      { $set: { status: "COMMITTED", committedAt: new Date() } },
      { new: true }
    );

    if (!committed) {

      await SalaryLine.deleteMany({ _id: { $in: lines.map((line) => line._id) } });

      return conflict(res, "Import batch has already been committed");
    }

    return res.status(200).json(toSalaryImport(committed));
  } catch (error) {
    return next(error);
  }
};

const listSalaryLines = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { mandoobId, companyId, period } = req.query;

    const filter = {};

    if (mandoobId) {
      filter.mandoobId = mongoose.isValidObjectId(mandoobId)
        ? mandoobId
        : MATCHES_NOTHING;
    }

    if (companyId) {
      filter.companyId = mongoose.isValidObjectId(companyId)
        ? companyId
        : MATCHES_NOTHING;
    }

    if (period) {
      filter.period =
        typeof period === "string" && PERIOD_PATTERN.test(period)
          ? period
          : MATCHES_NOTHING;
    }

    const [total, lines] = await Promise.all([
      SalaryLine.countDocuments(filter),

      SalaryLine.find(filter)
        .populate("companyId", "name")
        .sort({ period: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    return res.status(200).json(
      paginated({
        page,
        pageSize,
        total,
        items: lines.map(toSalaryLine),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const createSalaryLine = async (req, res, next) => {
  try {
    const { mandoobId, companyId, period, totalSalary } = req.body || {};
    const details = [];

    if (!mandoobId) {
      details.push({ field: "mandoobId", message: "mandoobId is required" });
    }

    if (!companyId) {
      details.push({ field: "companyId", message: "companyId is required" });
    }

    if (!period) {
      details.push({ field: "period", message: "period is required" });
    } else if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
      details.push({ field: "period", message: "must be in YYYY-MM format" });
    }

    if (totalSalary === undefined || totalSalary === null || totalSalary === "") {
      details.push({
        field: "totalSalary",
        message: "totalSalary is required",
      });
    } else if (!Number.isFinite(Number(totalSalary))) {
      details.push({ field: "totalSalary", message: "must be a number" });
    }

    if (details.length > 0) {
      return invalid(res, "Invalid input", details);
    }

    const [mandoob, company] = await Promise.all([
      findMandoobById(mandoobId),
      findCompanyById(companyId),
    ]);

    if (!mandoob) {
      return notFound(res, "Mandoob not found");
    }

    if (!company) {
      return notFound(res, "Company not found");
    }

    const line = await SalaryLine.create({
      mandoobId: mandoob._id,
      companyId: company._id,
      period,
      totalSalary: roundMoney(Number(totalSalary)),
      source: "MANUAL",
    });

    line.companyId = company;

    return res.status(201).json(toSalaryLine(line));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSalaryImports,
  createSalaryImport,
  getSalaryImport,
  commitSalaryImport,
  listSalaryLines,
  createSalaryLine,
};
