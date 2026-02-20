const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const { createError } = require("../middleware/errorHandler");
const { getIO } = require("../utils/socket"); // P3-PERF-003

exports.placeBid = async (req, res, next) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user._id;
    const now = new Date();

    // --- Vérifications préliminaires non-concurrentielles ---
    // (seller, status et minBidIncrement ne changent pas pendant la vie de l'enchère)
    const auctionCheck = await Auction.findById(auctionId)
      .select("status startTime endTime seller currentPrice minBidIncrement");

    if (!auctionCheck) {
      return next(createError.notFound("Enchère introuvable."));
    }

    if (
      auctionCheck.status !== "ongoing" ||
      now < new Date(auctionCheck.startTime) ||
      now > new Date(auctionCheck.endTime)
    ) {
      return next(createError.badRequest("L'enchère n'est pas active."));
    }

    if (auctionCheck.seller.toString() === userId.toString()) {
      return next(createError.forbidden("Tu ne peux pas enchérir sur ta propre enchère."));
    }

    // P4-META-001 — Validation de l'incrément minimum
    const increment = auctionCheck.minBidIncrement || 0;
    const minRequired = auctionCheck.currentPrice + increment;
    if (amount < minRequired) {
      return next(
        createError.badRequest(
          `Le montant minimum est de ${minRequired} (prix actuel ${auctionCheck.currentPrice} + incrément ${increment}).`
        )
      );
    }

    // P3-PERF-004 — Mise à jour ATOMIQUE avec condition de prix
    // La condition est évaluée et appliquée en une seule opération MongoDB.
    // Si deux enchères arrivent simultanément, une seule satisfait la condition.
    // P4-META-001 — La garde intègre minBidIncrement : currentPrice <= amount - increment
    const previousAuction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        status: "ongoing",
        endTime: { $gte: now },
        currentPrice: { $lte: amount - increment }, // Garde atomique avec incrément
      },
      {
        $set: { currentPrice: amount, winner: userId },
      },
      { new: false } // Retourne le document AVANT mise à jour (pour confirmer que ça a eu lieu)
    );

    if (!previousAuction) {
      // La condition $lt a échoué : une enchère concurrente est passée en premier
      return next(
        createError.conflict(
          "Une mise plus élevée vient d'être placée simultanément. Veuillez augmenter votre offre."
        )
      );
    }

    // Création du document Bid et ajout à la liste des enchères
    const bid = new Bid({ auction: auctionId, bidder: userId, amount });
    await bid.save();

    // $push séparé, non critique pour l'atomicité du prix
    await Auction.updateOne({ _id: auctionId }, { $push: { bids: bid._id } });

    // P3-PERF-003 — Diffuser la nouvelle enchère en temps réel
    getIO()?.to(`auction:${auctionId}`).emit("bid:new", {
      auctionId,
      amount,
      bidderId: userId,
      bidId: bid._id,
      createdAt: bid.createdAt,
    });

    return res.status(201).json({ message: "Offre placée avec succès.", bid });
  } catch (error) {
    next(createError.internal("Erreur serveur lors du placement de l'enchère."));
  }
};
