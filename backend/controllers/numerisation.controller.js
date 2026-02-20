const logger = require('../utils/logger');
const NumReq = require('../models/NumerisationRequest');
const { sendNumerisationRequestAlertToAdmin } = require('../services/mailer.service');
const { createError } = require("../middleware/errorHandler");

exports.createNumerisationRequest = async (req, res, next) => {
    try {
        const newRequest = new NumReq({
            ...req.body,
            userId: req.user._id
        });
        await newRequest.save();
        try {
            await sendNumerisationRequestAlertToAdmin(req.user, newRequest);
        } catch (emailError) {
            logger.error("Error sending email notification:", emailError);
        }
        res.status(201).json(newRequest);
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}

exports.getNumerisationRequests = async (req, res, next) => {
    try {
        const requests = await NumReq.find();
        res.status(200).json(requests);
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}

exports.getMyNumerisationRequests = async (req, res, next) => {
    try {
        const requests = await NumReq.find({ userId: req.user._id });
        res.status(200).json(requests);
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}

exports.updateNumerisationRequestStatus = async (req, res, next) => {
    try {
        const request = await NumReq.findOne({_id : req.params.id})
        if(!request) return next(createError.notFound('Request not found'));
        request.status = req.body.status
        if(req.body.price) request.price = req.body.price;
        if(req.body.comingDate) request.comingDate = req.body.comingDate;
        if(req.body.reason) request.reason = req.body.reason;
        await request.save()
        return res.json(request)
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}

exports.updateNumerisationRequest = async (req, res, next) => {
    try {
        const updatedRequest = await NumReq.findByIdAndUpdate(
            req.params.id,
            { ...req.body },
            { new: true }
        );
        if (!updatedRequest) {
            return next(createError.notFound('Request not found'));
        }
        res.status(200).json(updatedRequest);
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}

exports.deleteNumerisationRequest = async (req, res, next) => {
    try {
        const deletedRequest = await NumReq.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return next(createError.notFound('Request not found'));
        }
        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        next(createError.badRequest(error.message));
    }
}