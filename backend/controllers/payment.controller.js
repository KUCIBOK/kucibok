const payDunyaService = require('../services/paydunya.service');
const Transaction = require('../models/Transaction');
const Artwork = require('../models/Artwork');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { sendArtworkPurchaseEmailToUser, sendArtworkPurchaseEmailToAdmin } = require('../services/mailer.service');
const { createError } = require("../middleware/errorHandler");

/**
 * Initialiser un paiement PayDunya pour un artwork
 */
exports.initArtworkPayment = async (req, res, next) => {
  try {
    const { artworkId } = req.params;
    const userId = req.user._id;

    // Vérifier que l'artwork existe et est en vente
    const artwork = await Artwork.findOne({ 
      _id: artworkId, 
      forSale: true, 
      sold: false 
    }).populate('userId', 'name email');

    if (!artwork) {
      return next(createError.notFound("Cette œuvre n'est pas disponible à l'achat"));
    }

    // Vérifier que l'utilisateur n'achète pas sa propre œuvre
    if (artwork.userId._id.toString() === userId.toString()) {
      return next(createError.badRequest("Vous ne pouvez pas acheter votre propre œuvre"));
    }

    // Vérifier que l'utilisateur est un collector
    if (req.user.role !== 'collector') {
      return next(createError.forbidden("Seuls les collectionneurs peuvent acheter des œuvres"));
    }

    // Créer la transaction
    const transaction = new Transaction({
      artworkId: artwork._id,
      sellerId: artwork.userId._id,
      buyerId: userId,
      amount: artwork.price,
      currency: artwork.currency || 'XOF',
      method: 'paydunya',
      paymentStatus: 'pending'
    });

    await transaction.save();

    // Créer la facture PayDunya
    const invoice = await payDunyaService.createArtworkInvoice(transaction, artwork, req.user);

    if (!invoice.success) {
      transaction.paymentStatus = 'failed';
      await transaction.save();
      
      return next(createError.internal("Erreur lors de la création de la facture PayDunya"));
    }

    // Mettre à jour la transaction avec le token PayDunya
    transaction.transactionId = invoice.invoiceToken;
    await transaction.save();

    res.status(200).json({
      success: true,
      transaction: {
        _id: transaction._id,
        amount: transaction.amount,
        currency: transaction.currency
      },
      paymentUrl: invoice.invoiceUrl,
      token: invoice.invoiceToken
    });

  } catch (error) {
    console.error('Erreur initArtworkPayment:', error);
    next(createError.internal("Erreur interne du serveur"));
  }
};

/**
 * Initialiser un paiement PayDunya pour un abonnement
 */
exports.initSubscriptionPayment = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user._id;

    // Vérifier que l'abonnement existe
    const subscription = await Subscription.findOne({ 
      _id: subscriptionId, 
      userId: userId,
      status: 'pending'
    });

    if (!subscription) {
      return next(createError.notFound("Abonnement non trouvé"));
    }

    // Récupérer le plan
    const plan = await Plan.findById(subscription.planId);
    if (!plan) {
      return next(createError.notFound("Plan d'abonnement non trouvé"));
    }

    // Créer la facture PayDunya
    const invoice = await payDunyaService.createSubscriptionInvoice(subscription, plan, req.user);

    if (!invoice.success) {
      subscription.status = 'failed';
      await subscription.save();
      
      return next(createError.internal("Erreur lors de la création de la facture PayDunya"));
    }

    // Mettre à jour l'abonnement avec le token PayDunya
    subscription.paymentToken = invoice.invoiceToken;
    await subscription.save();

    res.status(200).json({
      success: true,
      subscription: {
        _id: subscription._id,
        amount: subscription.amount,
        currency: plan.currency
      },
      paymentUrl: invoice.invoiceUrl,
      token: invoice.invoiceToken
    });

  } catch (error) {
    console.error('Erreur initSubscriptionPayment:', error);
    next(createError.internal("Erreur interne du serveur"));
  }
};

/**
 * Gérer les callbacks PayDunya
 */
exports.handlePayDunyaCallback = async (req, res, next) => {
  try {
    const callbackData = req.body;

    // Traiter le callback
    const result = await payDunyaService.processCallback(callbackData);

    if (!result.success) {
      console.error('Erreur callback PayDunya:', result.error);
      return next(createError.badRequest(result.error));
    }

    const { customData, status, transactionId } = result;

    // Déterminer le type de transaction
    const transactionType = customData?.find(item => item.type)?.type;

    // P1-SEC-015 — Correction : this.X est undefined ici, utiliser exports.X
    if (transactionType === 'artwork_purchase') {
      await exports.processArtworkPurchase(customData, status, transactionId);
    } else if (transactionType === 'subscription_payment') {
      await exports.processSubscriptionPayment(customData, status, transactionId);
    }

    res.status(200).json({ message: 'Callback traité avec succès' });

  } catch (error) {
    console.error('Erreur handlePayDunyaCallback:', error);
    next(createError.internal("Erreur lors du traitement du callback"));
  }
};

/**
 * Traiter l'achat d'une œuvre d'art
 */
exports.processArtworkPurchase = async (customData, status, transactionId) => {
  const transactionIdFromData = customData?.find(item => item.transactionId)?.transactionId;

  if (!transactionIdFromData) {
    throw new Error('ID de transaction manquant dans les données custom');
  }

  const transaction = await Transaction.findById(transactionIdFromData)
    .populate('artworkId')
    .populate('buyerId', 'name email')
    .populate('sellerId', 'name email');

  if (!transaction) {
    throw new Error('Transaction non trouvée');
  }

  // P1-SEC-015 — Idempotence : ignorer les callbacks en double sur une transaction terminée
  if (transaction.paymentStatus === 'completed' || transaction.paymentStatus === 'failed') {
    console.info(`[PayDunya] callback ignoré — transaction ${transactionIdFromData} déjà en état "${transaction.paymentStatus}"`);
    return;
  }

  if (status === 'completed') {
    // Paiement réussi
    transaction.paymentStatus = 'completed';
    transaction.transactionId = transactionId;
    await transaction.save();

    // Mettre à jour l'artwork
    const artwork = transaction.artworkId;
    artwork.ownerId = transaction.buyerId._id;
    artwork.forSale = false;
    artwork.sold = true;
    artwork.soldAt = new Date();
    artwork.soldPrice = transaction.amount;
    artwork.isDelivered = 'pending';
    await artwork.save();

    // Envoyer les emails
    try {
      await sendArtworkPurchaseEmailToUser(
        transaction.buyerId.email,
        artwork,
        transaction,
        transaction.sellerId,
        transaction.buyerId
      );
      await sendArtworkPurchaseEmailToAdmin(artwork, transaction, transaction.buyerId);
    } catch (emailError) {
      console.error('Erreur envoi emails:', emailError);
    }

  } else {
    // Paiement échoué
    transaction.paymentStatus = 'failed';
    await transaction.save();
  }
};

/**
 * Traiter le paiement d'un abonnement
 */
exports.processSubscriptionPayment = async (customData, status, transactionId) => {
  const subscriptionIdFromData = customData?.find(item => item.subscriptionId)?.subscriptionId;

  if (!subscriptionIdFromData) {
    throw new Error("ID d'abonnement manquant dans les données custom");
  }

  const subscription = await Subscription.findById(subscriptionIdFromData)
    .populate('userId', 'name email')
    .populate('planId');

  if (!subscription) {
    throw new Error('Abonnement non trouvé');
  }

  // P1-SEC-015 — Idempotence : ignorer les callbacks en double sur un abonnement terminé
  if (subscription.status === 'active' || subscription.status === 'failed') {
    console.info(`[PayDunya] callback ignoré — abonnement ${subscriptionIdFromData} déjà en état "${subscription.status}"`);
    return;
  }

  if (status === 'completed') {
    // P1-SEC-015 — Durée lue depuis le plan (fin du hardcodage 30 jours)
    const durationDays = subscription.planId?.durationDays ?? 30;

    subscription.status = 'active';
    subscription.startDate = new Date();
    subscription.endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    subscription.paymentTransactionId = transactionId;
    await subscription.save();

    // Mettre à jour l'utilisateur
    const user = await User.findById(subscription.userId._id);
    user.subscription = subscription._id;
    user.plan = subscription.planId._id;
    await user.save();

  } else {
    // Paiement échoué
    subscription.status = 'failed';
    await subscription.save();
  }
};

/**
 * Vérifier un paiement PayDunya
 */
exports.verifyPayDunyaPayment = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await payDunyaService.checkPaymentStatus(token);

    if (!result.success) {
      return next(createError.badRequest("Erreur lors de la vérification du paiement"));
    }

    res.status(200).json({
      success: true,
      status: result.status,
      transactionId: result.transactionId
    });

  } catch (error) {
    console.error('Erreur verifyPayDunyaPayment:', error);
    next(createError.internal("Erreur interne du serveur"));
  }
};

// Placeholders pour les autres méthodes de paiement
exports.initFlutterwavePayment = async (req, res, next) => {
  next(createError.internal("Flutterwave non encore implémenté"));
};

exports.initCinetPayPayment = async (req, res, next) => {
  next(createError.internal("CinetPay non encore implémenté"));
};
