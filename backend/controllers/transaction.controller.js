const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');
const Artwork = require('../models/Artwork')
const axios = require('axios')
const { createError } = require("../middleware/errorHandler");


// Créer une transaction
exports.createTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (err) {
    logger.info(err.message)
    next(createError.badRequest(err.message));
  }
};

// Obtenir toutes les transactions
exports.getAllTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find()
      .populate('artworkId sellerId buyerId');
    res.status(200).json(transactions);
  } catch (err) {
    next(createError.internal(err.message));
  }
};

// Obtenir une transaction par ID
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({_id : req.params.id})
    if (!transaction) return next(createError.notFound('Transaction non trouvée'));
    res.status(200).json(transaction);
  } catch (err) {
    next(createError.internal(err.message));
  }
};

exports.failTransaction = async function (req, res, next) {
  try {
    const transaction = await Transaction.findOne({_id : req.params.id, paymentStatus : 'pending'})
    if(!transaction?._id) return next(createError.notFound("La tentative d'achat n'existe pas"));
    transaction.paymentStatus = 'failed'
    await transaction.save()
    const artwork = await Artwork.findOne({_id : transaction?.artworkId})
    if(!artwork?._id) return next(createError.notFound("L'oeuvre que vous avez tenté d'acheter n'existe pas"));
    
    return res.status(200).json({transaction, artwork})
  } catch (error) {
    logger.info(error)
    return next(createError.internal("Erreur lors de l'échec de la transaction"));
  }
}

// Supprimer une transaction
exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) return next(createError.notFound('Transaction non trouvée'));
    res.status(200).json({ message: 'Transaction supprimée' });
  } catch (err) {
    next(createError.internal(err.message));
  }
};

exports.deleteAll = async (req, res, next) => {
    try {
        await Transaction.deleteMany({})
    } catch (error) {
        return next(createError.internal("Erreur lors de la suppression"));
    }
}