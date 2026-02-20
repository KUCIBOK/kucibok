const logger = require('../utils/logger');
const Integration = require("../models/Integration");
const mongoose = require("mongoose");
const createError = require("http-errors");
const axios = require("axios");

// ✅ Get all integrations for professional
exports.getIntegrations = async (req, res, next) => {
  try {
    const professionalId = req.user._id;

    const integrations = await Integration.find({ professionalId }).select(
      "-credentials"
    );

    res.status(200).json(integrations);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Get single integration
exports.getIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const integration = await Integration.findById(id).select("-credentials");

    if (!integration) {
      return next(createError.notFound("Integration not found"));
    }

    // Check access
    if (integration.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden("Access denied"));
    }

    res.status(200).json(integration);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Connect integration
exports.connectIntegration = async (req, res, next) => {
  try {
    const { name, credentials, settings } = req.body;
    const professionalId = req.user._id;

    // Check if already connected
    let integration = await Integration.findOne({
      professionalId,
      name,
    });

    if (integration) {
      // Update existing
      integration.credentials = credentials;
      integration.settings = { ...integration.settings, ...settings };
      integration.isConnected = true;
      integration.connectedAt = new Date();
      await integration.save();
    } else {
      // Create new
      integration = new Integration({
        name,
        professionalId,
        credentials,
        settings,
        isConnected: true,
        connectedAt: new Date(),
      });
      await integration.save();
    }

    // Test connection based on integration type
    const isValid = await testIntegration(name, credentials);

    if (!isValid) {
      integration.isConnected = false;
      await integration.save();
      return next(createError.badRequest("Failed to connect integration"));
    }

    res.status(201).json({
      message: "Integration connected successfully",
      integration: integration.toJSON(),
    });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Update integration settings
exports.updateIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    const integration = await Integration.findById(id);

    if (!integration) {
      return next(createError.notFound("Integration not found"));
    }

    // Check access
    if (integration.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden("Access denied"));
    }

    integration.settings = { ...integration.settings, ...settings };
    integration.updatedAt = new Date();
    await integration.save();

    res.status(200).json({
      message: "Integration updated",
      integration: integration.toJSON(),
    });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Disconnect integration
exports.disconnectIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = await Integration.findById(id);

    if (!integration) {
      return next(createError.notFound("Integration not found"));
    }

    // Check access
    if (integration.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden("Access denied"));
    }

    integration.isConnected = false;
    integration.disconnectedAt = new Date();
    await integration.save();

    res.status(200).json({
      message: "Integration disconnected",
    });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Manual sync
exports.syncIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = await Integration.findById(id);

    if (!integration) {
      return next(createError.notFound("Integration not found"));
    }

    // Check access
    if (integration.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden("Access denied"));
    }

    if (!integration.isConnected) {
      return next(createError.badRequest("Integration not connected"));
    }

    integration.syncStatus = "syncing";
    await integration.save();

    try {
      // Call appropriate sync function
      const syncResult = await syncIntegrationData(integration);

      integration.syncStatus = "success";
      integration.lastSync = new Date();
      integration.totalSyncs += 1;
      integration.syncErrorMessage = null;
      await integration.save();

      res.status(200).json({
        message: "Sync completed",
        result: syncResult,
      });
    } catch (syncError) {
      integration.syncStatus = "error";
      integration.syncErrorMessage = syncError.message;
      await integration.save();

      next(createError.badRequest(`Sync failed: ${syncError.message}`));
    }
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Test integration connection
async function testIntegration(name, credentials) {
  try {
    switch (name) {
      case "logidoo":
        return await testLogidooConnection(credentials);
      case "gmail":
      case "outlook":
        return await testEmailConnection(credentials);
      case "google_calendar":
        return await testCalendarConnection(credentials);
      case "instagram":
      case "facebook":
      case "twitter":
      case "tiktok":
        return await testSocialConnection(credentials);
      case "webhook":
        return true; // Webhooks don't need testing
      default:
        return false;
    }
  } catch (error) {
    logger.error(`Test failed for ${name}:`, error.message);
    return false;
  }
}

// Test Logidoo connection
async function testLogidooConnection(credentials) {
  try {
    const response = await axios.get("https://api-staging.logidoo.co/shipments", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.status === 200;
  } catch (error) {
    logger.error("Logidoo test failed:", error.message);
    return false;
  }
}

// Test email connection
async function testEmailConnection(credentials) {
  // In production, implement SMTP test or OAuth token validation
  return !!(credentials.email && (credentials.password || credentials.accessToken));
}

// Test calendar connection
async function testCalendarConnection(credentials) {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      }
    );
    return response.status === 200;
  } catch (error) {
    logger.error("Calendar test failed:", error.message);
    return false;
  }
}

// Test social connection
async function testSocialConnection(credentials) {
  // Basic validation - in production, verify token with API
  return !!credentials.accessToken;
}

// Sync integration data
async function syncIntegrationData(integration) {
  switch (integration.name) {
    case "logidoo":
      return await syncLogidooData(integration);
    case "google_calendar":
      return await syncCalendarData(integration);
    default:
      return { message: "No sync available for this integration" };
  }
}

// Sync Logidoo shipments
async function syncLogidooData(integration) {
  try {
    const response = await axios.get("https://api-staging.logidoo.co/shipments", {
      headers: {
        Authorization: `Bearer ${integration.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Store shipment count as metadata
    const shipmentCount = Array.isArray(response.data)
      ? response.data.length
      : response.data?.count || 0;

    integration.metadata = {
      lastSyncedShipments: shipmentCount,
      shipmentData: response.data,
    };

    return {
      message: "Logidoo sync successful",
      shipmentCount,
    };
  } catch (error) {
    throw new Error(`Logidoo sync failed: ${error.message}`);
  }
}

// Sync Google Calendar
async function syncCalendarData(integration) {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        headers: {
          Authorization: `Bearer ${integration.credentials.accessToken}`,
        },
        params: {
          maxResults: 10,
          orderBy: "startTime",
          singleEvents: true,
          timeMin: new Date().toISOString(),
        },
      }
    );

    const eventCount = response.data.items?.length || 0;

    integration.metadata = {
      lastSyncedEvents: eventCount,
      nextEvent: response.data.items?.[0],
    };

    return {
      message: "Calendar sync successful",
      eventCount,
    };
  } catch (error) {
    throw new Error(`Calendar sync failed: ${error.message}`);
  }
}

// ✅ Get integration stats
exports.getIntegrationStats = async (req, res, next) => {
  try {
    const professionalId = req.user._id;

    const stats = await Integration.aggregate([
      { $match: { professionalId: mongoose.Types.ObjectId(professionalId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          connected: {
            $sum: { $cond: ["$isConnected", 1, 0] },
          },
          disconnected: {
            $sum: { $cond: ["$isConnected", 0, 1] },
          },
          byType: {
            $push: {
              name: "$name",
              isConnected: "$isConnected",
              lastSync: "$lastSync",
            },
          },
        },
      },
    ]);

    res.status(200).json(stats[0] || { total: 0, connected: 0 });
  } catch (error) {
    next(createError.internal(error.message));
  }
};
