// P3-PERF-002 — Cron optimisé pour la mise à jour des statuts d'enchères
const cron = require("node-cron");
const Auction = require("../models/Auction");
const logger = require("../utils/logger");

/**
 * Met à jour les statuts d'enchères de façon atomique.
 * Émission socket.io (auction:ended) si `io` est injecté.
 * @param {import('socket.io').Server|null} io - Instance Socket.IO (optionnel)
 */
const updateAuctionStatuses = async (io = null) => {
  const now = new Date();

  // P3-PERF-002 — Sortie anticipée : aucune enchère en transition probable
  const hasRelevant = await Auction.exists({
    $or: [
      { status: "upcoming", startTime: { $lte: now } },
      { status: "ongoing",  endTime:   { $lte: now } },
    ],
  });
  if (!hasRelevant) return;

  try {
    // upcoming → ongoing (l'index { status, startTime } est utilisé)
    const upcoming = await Auction.updateMany(
      { status: "upcoming", startTime: { $lte: now } },
      { $set: { status: "ongoing" } }
    );

    // ongoing → ended (l'index { status, endTime } est utilisé)
    // On récupère les IDs AVANT updateMany pour émettre les événements socket
    let endedIds = [];
    if (io) {
      const toEnd = await Auction.find(
        { status: "ongoing", endTime: { $lte: now } },
        { _id: 1 }
      ).lean();
      endedIds = toEnd.map((a) => a._id.toString());
    }

    const ended = await Auction.updateMany(
      { status: "ongoing", endTime: { $lte: now } },
      { $set: { status: "ended" } }
    );

    // Émettre auction:ended dans chaque room concernée
    if (io && endedIds.length > 0) {
      endedIds.forEach((auctionId) => {
        io.to(`auction:${auctionId}`).emit("auction:ended", { auctionId });
      });
    }

    if (upcoming.modifiedCount > 0 || ended.modifiedCount > 0) {
      logger.info(
        `[CRON] ${upcoming.modifiedCount} enchère(s) activée(s), ${ended.modifiedCount} terminée(s)`
      );
    }
  } catch (err) {
    logger.error("[CRON] Erreur mise à jour des statuts d'enchères", {
      message: err.message,
      stack: err.stack,
    });
  }
};

/**
 * Démarre le cron d'enchères.
 * @param {import('socket.io').Server|null} io - Instance Socket.IO (optionnel)
 */
function startAuctionCron(io = null) {
  // P3-PERF-002 — Toutes les 5 min (au lieu de chaque minute)
  // Précision acceptable pour des enchères dont la durée est en heures
  cron.schedule("*/5 * * * *", async () => {
    await updateAuctionStatuses(io);
  });
  logger.info("[CRON] Cron d'enchères démarré (*/5 * * * *)");
}

module.exports = { startAuctionCron };
