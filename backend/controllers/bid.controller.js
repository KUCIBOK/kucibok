const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const { createError } = require("../middleware/errorHandler");

exports.placeBid = async (req, res, next) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user._id;
    const now = new Date();

    // --- Vérifications préliminaires non-concurrentielles ---
    // (seller et status ne changent pas pendant la vie de l'enchère)
    const auctionCheck = await Auction.findById(auctionId)
      .select("status startTime endTime seller currentPrice");

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

    if (amount <= auctionCheck.currentPrice) {
      return next(
        createError.badRequest(
          `Le montant doit être supérieur au prix actuel (${auctionCheck.currentPrice}).`
        )
      );
    }

    // P3-PERF-004 — Mise à jour ATOMIQUE avec condition de prix
    // La condition { currentPrice: { $lt: amount } } est évaluée et appliquée
    // en une seule opération MongoDB. Si deux enchères arrivent simultanément,
    // une seule peut satisfaire la condition → l'autre reçoit null.
    const previousAuction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        status: "ongoing",
        endTime: { $gte: now },
        currentPrice: { $lt: amount }, // Garde atomique anti race condition
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

    return res.status(201).json({ message: "Offre placée avec succès.", bid });
  } catch (error) {
    next(createError.internal("Erreur serveur lors du placement de l'enchère."));
  }
};
