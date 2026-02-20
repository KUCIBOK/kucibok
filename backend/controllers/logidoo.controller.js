const logger = require('../utils/logger');
const logidooService = require('../services/logidoo.service');
const Delivery = require('../models/DeliveryRequest');
const { createError } = require("../middleware/errorHandler");
const { logidooAuth } = require("../middleware/logidooAuth");

// Sync Kucibok deliveries with Logidoo
exports.syncWithLogidoo = async (req, res, next) => {
  try {
    // Get all pending deliveries from Kucibok
    const kucibokDeliveries = await Delivery.find({ 
      status: { $in: ['pending', 'in_preparation', 'on_the_way'] } 
    }).populate('userId');

    const syncedDeliveries = [];
    
    for (const delivery of kucibokDeliveries) {
      try {
        // Check if delivery already exists in Logidoo
        let logidooExpedition;
        if (delivery.trackingId) {
          try {
            logidooExpedition = await logidooService.getExpeditionById(delivery.trackingId);
          } catch (error) {
            // Expedition doesn't exist, create new one
            logidooExpedition = null;
          }
        }

        // Prepare expedition data for Logidoo
        const expeditionData = {
          recipient: {
            name: delivery.recipientName,
            phone: delivery.recipientPhone,
            email: delivery.userId?.email,
            address: delivery.deliveryAddress
          },
          package: {
            weight: delivery.packageWeight || 1,
            dimensions: {
              length: delivery.packageSize === 'small' ? 20 : 
                     delivery.packageSize === 'medium' ? 30 :
                     delivery.packageSize === 'large' ? 40 : 50,
              width: delivery.packageSize === 'small' ? 15 : 
                    delivery.packageSize === 'medium' ? 20 :
                    delivery.packageSize === 'large' ? 25 : 30,
              height: delivery.packageSize === 'small' ? 10 : 
                     delivery.packageSize === 'medium' ? 15 :
                     delivery.packageSize === 'large' ? 20 : 25
            },
            description: `Artwork delivery from Kucibok - ${delivery.artworksIds?.length || 0} items`
          },
          serviceType: delivery.deliveryPriority === 'express' ? 'EXPRESS' : 
                      delivery.deliveryPriority === 'priority' ? 'PRIORITY' : 'STANDARD',
          collectionDate: delivery.collectDate ? new Date(delivery.collectDate) : new Date(),
          deliveryDate: delivery.deliveryDate ? new Date(delivery.deliveryDate) : null,
          reference: `KCB-${delivery._id}`
        };

        if (!logidooExpedition) {
          // Create new expedition in Logidoo
          logidooExpedition = await logidooService.createExpedition(expeditionData);
          // Update Kucibok delivery with Logidoo tracking ID
          delivery.trackingId = logidooExpedition.id;
          delivery.status = 'in_preparation';
          await delivery.save();
        } else {
          // Update existing expedition
          await logidooService.updateExpedition(delivery.trackingId, expeditionData);
        }

        syncedDeliveries.push({
          kucibokId: delivery._id,
          logidooId: logidooExpedition.id,
          trackingId: delivery.trackingId,
          status: delivery.status
        });

      } catch (error) {
        logger.error(`Error syncing delivery ${delivery._id}:`, error.message);
        // Continue with other deliveries
      }
    }

    return res.status(200).json({
      message: 'Sync completed',
      syncedCount: syncedDeliveries.length,
      deliveries: syncedDeliveries
    });

  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get delivery tracking info from Logidoo
exports.getTrackingInfo = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    
    // First try to get from Logidoo
    try {
      const trackingInfo = await logidooService.trackExpedition(trackingId);
      
      // Also get status history
      const history = await logidooService.getExpeditionHistory(trackingId);
      
      return res.status(200).json({
        trackingId,
        currentStatus: trackingInfo.status,
        location: trackingInfo.location,
        estimatedDelivery: trackingInfo.estimatedDelivery,
        history: history.events || [],
        provider: 'Logidoo'
      });
    } catch (logidooError) {
      // If not found in Logidoo, try Kucibok database
      const delivery = await Delivery.findOne({ trackingId });
      if (!delivery) {
        return next(createError.notFound('Delivery not found'));
      }

      return res.status(200).json({
        trackingId,
        currentStatus: delivery.status,
        recipient: {
          name: delivery.recipientName,
          phone: delivery.recipientPhone,
          address: delivery.deliveryAddress
        },
        package: {
          size: delivery.packageSize,
          weight: delivery.packageWeight
        },
        dates: {
          collect: delivery.collectDate,
          delivery: delivery.deliveryDate
        },
        provider: 'Kucibok'
      });
    }

  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get all expeditions from Logidoo
exports.getLogidooExpeditions = async (req, res, next) => {
  try {
    const expeditions = await logidooService.getExpeditions();
    return res.status(200).json(expeditions);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get shipping rates from Logidoo
exports.getShippingRates = async (req, res, next) => {
  try {
    const { origin, destination, packageDetails } = req.body;
    
    if (!origin || !destination || !packageDetails) {
      return next(createError.badRequest('Missing required parameters'));
    }

    const rates = await logidooService.calculatePrice(origin, destination, packageDetails);
    return res.status(200).json(rates);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get delivery zones from Logidoo
exports.getDeliveryZones = async (req, res, next) => {
  try {
    const zones = await logidooService.getDeliveryZones();
    return res.status(200).json(zones);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get pickup points from Logidoo
exports.getPickupPoints = async (req, res, next) => {
  try {
    const pickupPoints = await logidooService.getPickupPoints();
    return res.status(200).json(pickupPoints);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Update delivery status based on Logidoo tracking
exports.updateFromLogidoo = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    
    // Get latest status from Logidoo
    const trackingInfo = await logidooService.trackExpedition(trackingId);
    
    // Update Kucibok delivery
    const delivery = await Delivery.findOne({ trackingId });
    if (!delivery) {
      return next(createError.notFound('Delivery not found in Kucibok'));
    }

    // Map Logidoo status to Kucibok status
    const statusMap = {
      'pending': 'pending',
      'preparing': 'in_preparation',
      'in_transit': 'on_the_way',
      'out_for_delivery': 'on_the_way',
      'delivered': 'delivered',
      'cancelled': 'rejected'
    };

    delivery.status = statusMap[trackingInfo.status] || delivery.status;
    
    if (trackingInfo.status === 'delivered' && trackingInfo.deliveryDate) {
      delivery.deliveryDate = new Date(trackingInfo.deliveryDate);
    }

    await delivery.save();

    return res.status(200).json({
      message: 'Delivery status updated',
      kucibokId: delivery._id,
      trackingId: delivery.trackingId,
      status: delivery.status,
      logidooStatus: trackingInfo.status
    });

  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Cancel delivery in Logidoo
exports.cancelDelivery = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    
    // Cancel in Logidoo
    await logidooService.cancelExpedition(trackingId);
    
    // Update Kucibok delivery
    const delivery = await Delivery.findOne({ trackingId });
    if (delivery) {
      delivery.status = 'rejected';
      delivery.reason = 'Cancelled via Logidoo integration';
      await delivery.save();
    }

    return res.status(200).json({
      message: 'Delivery cancelled successfully',
      trackingId
    });

  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Create a new expedition directly
exports.createExpedition = async (req, res, next) => {
  try {
    const expeditionData = req.body;
    
    // Create expedition in Logidoo
    const expedition = await logidooService.createExpedition(expeditionData);
    
    return res.status(201).json({
      message: 'Expedition created successfully',
      expedition
    });

  } catch (error) {
    return next(createError.internal(error.message));
  }
};

// Get expedition by tracking number
exports.getExpeditionByTracking = async (req, res, next) => {
  try {
    const { trackingNumber } = req.params;
    
    const expedition = await logidooService.getExpeditionByTracking(trackingNumber);
    
    return res.status(200).json(expedition);

  } catch (error) {
    return next(createError.internal(error.message));
  }
};
