const logger = require('../utils/logger');
const Gallery = require("../models/Gallery.js");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const { createError } = require("../middleware/errorHandler");

const getGalleries = async (req, res, next) => {
  try {
    const galleries = await Gallery.find(
      { email: { $exists: true, $type: "string", $nin: [null, "", "-"] } },
      { name: 1, email: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    res.json(galleries);
  } catch (err) {
    next(createError.internal(err.message));
  }
};

// POST /api/galleries/import -> multipart/form-data (file)
// POST /api/galleries/import -> multipart/form-data (file)
async function importGalleries(req, res, next) {
  try {
    logger.info("📥 importGalleries démarré");

    if (!req.file) {
      logger.warn("⚠️ Aucun fichier reçu dans req.file");
      return next(createError.badRequest("Aucun fichier fourni (champ 'file')."));
    }

    logger.info("✅ Fichier reçu :", req.file);

    const filePath = path.resolve(req.file.path);
    const ext = path.extname(filePath).toLowerCase();
    logger.info("📂 filePath:", filePath, "| extension:", ext);

    let rows = [];
    if (ext === ".csv") {
      logger.info("➡️ Parsing CSV...");
      rows = await parseCSV(filePath);
    } else if (ext === ".xlsx" || ext === ".xls") {
      logger.info("➡️ Parsing XLSX...");
      rows = parseXLSX(filePath);
    } else {
      cleanup(filePath);
      logger.error("❌ Format non supporté:", ext);
      return next(createError.badRequest("Format non supporté. Utilisez CSV ou XLSX."));
    }

    logger.info("✅ Nombre de lignes parsées:", rows.length);

    const stats = {
      totalRows: rows.length,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorsCount: 0,
      errors: [],
    };

    for (const [idx, raw] of rows.entries()) {
      try {
        const name = normalizeString(
          raw.name ?? raw.Name ?? raw.NOM ?? raw.nom
        );
        const email = normalizeEmail(
          raw.email ?? raw.Email ?? raw.EMAIL ?? raw.mail ?? raw.Mail
        );

        if (!email) {
          stats.skippedCount++;
          continue;
        }

        const baseDoc = { name: name || "n/a", email };
        logger.info(`🔎 [Row ${idx + 1}] baseDoc:`, baseDoc);

        const existing = await Gallery.findOne({ email }).lean();
        if (existing) {
          logger.info(`✏️ [Row ${idx + 1}] Mise à jour de ${email}`);
          await Gallery.updateOne({ _id: existing._id }, { $set: baseDoc });
          stats.updatedCount++;
        } else {
          logger.info(`➕ [Row ${idx + 1}] Insertion de ${email}`);
          await Gallery.create(baseDoc);
          stats.insertedCount++;
        }
      } catch (e) {
        logger.error(`❌ Erreur sur la ligne ${idx + 1}:`, e);
        stats.errorsCount++;
        stats.errors.push({ row: idx + 1, message: e.message });
      }
    }

    cleanup(filePath);
    logger.info("🧹 Fichier temporaire supprimé");

    const withEmailCount = await Gallery.countDocuments({
      email: { $exists: true, $type: "string", $nin: [null, "", "-"] },
    });

    logger.info("📊 Stats finales:", stats);

    return res.json({ ok: true, ...stats, withEmailCount });
  } catch (err) {
    logger.error("💥 Erreur fatale dans importGalleries:", err);
    return next(createError.internal(err.message));
  }
}

// Helpers
function normalizeString(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (s === "" || s === "-" || s.toLowerCase() === "n/a") return undefined;
  return s;
}

function normalizeEmail(v) {
  const s = normalizeString(v);
  if (!s) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return undefined;
  return s.toLowerCase();
}

function parseXLSX(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", () => resolve(rows))
      .on("error", (err) => reject(err));
  });
}

function cleanup(filePath) {
  fs.unlink(filePath, () => {});
}

module.exports = { getGalleries, importGalleries };
