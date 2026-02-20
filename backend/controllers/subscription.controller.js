const logger = require('../utils/logger');
const Subscription = require('../models/Subscription')
const User = require('../models/User')
const Plan = require('../models/Plan');
const {sendSubscriptionPaymentEmailToUser, sendSubscriptionPaymentEmailToAdmin} = require('../services/mailer.service')
const { createError } = require("../middleware/errorHandler");

exports.create = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    const plan = await Plan.findById(planId);
    if (!plan) return next(createError.notFound('Plan non trouvé'));

    const startDate = new Date();
    const endDate = new Date();
    const nextPaymentDate = new Date();
    if(plan?.duration == "monthly"){
        endDate.setDate(startDate.getDate() + 30);
        nextPaymentDate.setMonth(startDate.getMonth() + 1);
    }
    else{
        endDate.setDate(startDate.getDate() + 364);
        nextPaymentDate.setFullYear(startDate.getFullYear() + 1);
    }
    const subscription = await Subscription.create({
      userId,
      planId,
      planRole : plan?.role,
      planName : plan?.name,
      amount : plan?.price,
      currency : plan?.currency,
      nextPaymentDate,
      startDate,
      endDate,
    });

    res.status(201).json(subscription);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

exports.activateSubscription = async (req, res, next) => {
    try {
        const sub = await Subscription.findOne({_id : req.params.subId, status : "pending"})
        if(!sub) return next(createError.notFound("La tentative de paiement n'existe pas"));
        sub.status = "active"
        await sub.save()
        const plan = await Plan.findOne({_id : sub?.planId})
        if(!plan) return next(createError.notFound('Le plan pour lequel vous voulez souscrire n\'existe pas, veuillez contacter le service client pour un remboursement.'));
        const user = await User.findOne({_id : sub?.userId})
        try {
            await sendSubscriptionPaymentEmailToUser(user?.name, sub);
            await sendSubscriptionPaymentEmailToAdmin(sub, user);
        } catch (error) {
            logger.error("Erreur lors de l'envoi des emails de paiement d'abonnement:", error);
        }
        
        return res.json({sub, plan})
    } catch (error) {
        return next(createError.internal("Erreur pendant l'activation de l'abonnement"));
    }
}

exports.failSubscription = async (req, res, next) => {
    try {
        const sub = await Subscription.findOne({_id : req.params.subId, status : "pending"})
        if(!sub) return next(createError.notFound("La tentative de paiement n'existe pas"));
        sub.status = "failed"
        await sub.save()
        const plan = await Plan.findOne({_id : sub?.planId})
        if(!plan) return next(createError.notFound('Le plan pour lequel vous voulez souscrire n\'existe pas, veuillez contacter le service client pour un remboursement.'));
        return res.json({sub, plan})
    } catch (error) {
        return next(createError.internal("Erreur pendant l'activation de l'abonnement"));
    }
}

exports.getAllSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find().sort({ startDate: -1 });
        res.status(200).json(subscriptions);
    } catch (error) {
        logger.error('Error fetching subscriptions:', error);
        next(createError.internal('Internal server error'));
    }
}

exports.getSubscriptionById = async (req, res, next) => {
    try {
        const sub = await Subscription.findOne({_id : req.params.id})
        if(!sub?._id) return next(createError.notFound('Pas d\'abonnement.'));
        const plan = await Plan.findOne({_id : sub?.planId})
        if(!plan?._id) return next(createError.notFound('Pas de plan pour cet abonnement.'));
        return res.json({...sub, ...plan})
    } catch (error) {
        next(createError.internal('Internal server error'));
    }
}


//Récupérer l'abonnement actif d'un utilisateur
exports.getUserActiveSubscription = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const subscription = await Subscription.findOne({ userId, status: 'active' }).sort({ startDate: -1 });
        if (!subscription) {
            return next(createError.notFound('No active subscription found for this user'));
        }
        const plan = await Plan.findOne({_id : subscription?.planId})
        if (!plan) {
            return next(createError.notFound('No plan suscribed for this user'));
        }
        res.status(200).json({...subscription, ...plan});
    } catch (error) {
        logger.error('Error fetching active user subscription:', error);
        next(createError.internal('Internal server error'));
    }
}

//Récupérer tous les abonnements actifs pour l'admin
exports.getActiveSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find({ status: 'active' }).sort({ startDate: -1 });
        if (!subscriptions || subscriptions.length === 0) {
            return next(createError.notFound('No active subscriptions found'));
        }
        res.status(200).json(subscriptions);
    } catch (error) {
        logger.error('Error fetching active subscriptions:', error);
        next(createError.internal('Internal server error'));
    }
}

exports.cancelSubscription = async (req, res, next) => {
    try {
        const { subscriptionId } = req.params;
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) return next(createError.notFound('Subscription not found'));

        subscription.status = 'cancelled';
        await subscription.save();

        res.status(200).json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        next(createError.internal(error.message));
    }
};


