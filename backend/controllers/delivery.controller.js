const logger = require('../utils/logger');
const Delivery = require('../models/DeliveryRequest')
const Artwork = require('../models/Artwork')
const User = require('../models/User')
const {sendDeliveryRequestNotificationToAdmin, sendDeliveryRequestNoficationToCustomer} = require('../services/mailer.service')
const { createError } = require("../middleware/errorHandler");


exports.createDeliveryRequest = async (req, res, next) => { //✅
    try {
        const user = req.user
        const request = await Delivery.create({
            userId : user?._id,
            ...req.body
        })
        request?.artworksIds?.forEach(async (id) => {
            try {
                const artwork = await Artwork.findOne({_id : id})
                if(!artwork) return
                artwork.isDelivered = "pending"
                await artwork.save()
            } catch (error) {
                return
            }
        });
        try {
            await sendDeliveryRequestNotificationToAdmin(request)
        } catch (error) {
            logger.info('Erreur', error.message)
        }
        return res.status(201).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.getAllDeliveryRequest = async (req, res, next) => { //✅
    try {
        const requests = await Delivery.find()
        return res.status(200).json(requests)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.getDeliveryRequestById = async (req, res, next) => { //✅
    try {
        const request = await Delivery.findById(req.params.id)
        if(!request) return next(createError.notFound('La demande n\'a pas été trouvée.'));
        return res.status(200).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.getDeliveryRequestByUser = async (req, res, next) => { //✅
    try {
        const user = req.user
        const requests = await Delivery.find({userId : user?._id})
        return res.status(200).json(requests)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.changeDeliveryStatus = async (req, res, next) => { //✅
    try {
        const request = await Delivery.findOne({_id : req.params.id})
        if(!request) return next(createError.notFound('La demande n\'a pas été trouvée.'));
        request.status = req.body.status
        if(req.body.status != "rejected"){
            request.price = req.body.price
            request.trackingId = req.body.trackingId
        }
        else{
            request.reason = req.body.reason
        }
        await request.save()
        request?.artworksIds?.forEach(async (id) => {
            try {
                const artwork = await Artwork.findOne({_id : id})
                if(!artwork) return
                artwork.isDelivered = req.body.status
                await artwork.save()
            } catch (error) {
                return
            }
        });
        const user = await User.findById(request.userId);
        try {
            await sendDeliveryRequestNoficationToCustomer(user?.email, request)
        } catch (error) {
            logger.info("Erreur lors de l'envoi de mail", error.message)
        }
        return res.status(200).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.payForDelivery = async (req, res, next) => { //✅
    try {
        const request = await Delivery.findOne({_id : req.params.id, status : 'pending'})
        if(!request) return next(createError.notFound('La demande n\'a pas été trouvée.'));
        request.paymentStatus = 'paid'
        await request.save()
        return res.status(200).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.failDeliveryPayment = async (req, res, next) => { //✅
    try {
        const request = await Delivery.findOne({_id : req.params.id, status : 'pending'})
        if(!request) return next(createError.notFound('La demande n\'a pas été trouvée.'));
        request.paymentStatus = 'failed'
        await request.save()
        return res.status(200).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}

exports.deleteDeliveryRequest = async (req, res, next) => {
    try {
        const request = await Delivery.findByIdAndDelete(req.params.id)
        if(!request) return next(createError.notFound('La demande n\'a pas été trouvée.'));
        return res.status(200).json(request)
    } catch (error) {
        return next(createError.internal(error.message));
    }
}