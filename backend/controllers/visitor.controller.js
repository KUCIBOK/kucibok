const logger = require('../utils/logger');
const Visitor = require('../models/Visitor');
const { createError } = require("../middleware/errorHandler");


const createVisitor = async (req, res, next) => {
    try {
        const { ipAddress, userAgent, pageVisited, referrer, sessionId } = req.body;

        // Validate required fields
        if (!ipAddress || !userAgent || !pageVisited || !sessionId) {
            return next(createError.badRequest('Missing required fields'));
        }
        const visitorExists = await Visitor.findOne({ ipAddress });
        if (visitorExists) {
            return next(createError.conflict('Visitor already exists for this session'));
        }

        // Create a new visitor record
        const newVisitor = new Visitor({
            ipAddress,
            userAgent,
            pageVisited,
            referrer,
            sessionId
        });

        await newVisitor.save();
        const visitorCount = await Visitor.countDocuments();
        logger.info("Nombre de visiteurs enregistrés :", visitorCount);
        res.status(201).json(newVisitor);
    } catch (error) {
        logger.error('Error creating visitor:', error);
        next(createError.internal('Internal server error'));
    }
}

const getAllVisitors = async (req, res, next) => {
    try {
        const visitors = await Visitor.find().sort({ visitDate: -1 });
        res.status(200).json(visitors);
    } catch (error) {
        logger.error('Error fetching visitors:', error);
        next(createError.internal('Internal server error'));
    }
}

const deleteAllVisitors = async (req, res, next) => {
    try {
        await Visitor.deleteMany({});
        res.status(200).json({ message: 'All visitors deleted successfully' });
    } catch (error) {
        logger.error('Error deleting visitors:', error);
        next(createError.internal('Internal server error'));
    }
}

const setVisitTime = (req, res, next) => {
    const { sessionId, visitTime } = req.body;

    if (!sessionId || !visitTime) {
        return next(createError.badRequest('Missing required fields'));
    }

    Visitor.findOneAndUpdate(
        { sessionId },
        { $set: { visitTime } },
        { new: true }
    )
    .then(updatedVisitor => {
        if (!updatedVisitor) {
            return next(createError.notFound('Visitor not found'));
        }
        res.status(200).json(updatedVisitor);
    })
    .catch(error => {
        logger.error('Error updating visit time:', error);
        next(createError.internal('Internal server error'));
    });
}

module.exports = {
    createVisitor,
    getAllVisitors,
    setVisitTime,
    deleteAllVisitors,
};