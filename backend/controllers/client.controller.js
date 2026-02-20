const logger = require('../utils/logger');
const mongoose = require("mongoose");
const Client = require("../models/Client");
const { createError } = require("../middleware/errorHandler");
const clientService = require("../services/client.service");

exports.uploadClients = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return next(createError.badRequest("Aucun fichier fourni."));
  }

  try {
    const result = await clientService.processClientFileUpload(file, req.user?._id);
    res.status(201).json(result);
  } catch (err) {
    logger.error("Erreur détaillée:", err);
    if (err.message === "Format de fichier non supporté.") {
      return next(createError.badRequest(err.message));
    }
    return next(createError.internal("Erreur lors de l'import des clients."));
  }
};

exports.addClient = async (req, res, next) => {
  try {
    const { nom, prenom, email, telephone, ville } = req.body;

    // Validation des données
    try {
      clientService.validateClientData({ nom, prenom, email, telephone });
    } catch (error) {
      return next(createError.badRequest(error.message));
    }

    // Vérification des doublons
    try {
      await clientService.checkClientDuplicates(email, telephone);
    } catch (error) {
      return next(createError.conflict(error.message));
    }

    const newClient = new Client({
      nom,
      prenom,
      email,
      telephone: telephone && telephone.trim() !== "" ? telephone : undefined,
      ville,
      artistId: req.user?._id || new mongoose.Types.ObjectId(),
    });

    await newClient.save();

    res.status(201).json({
      message: "Client ajouté avec succès.",
      client: newClient,
    });
  } catch (err) {
    logger.error("Erreur lors de l'ajout du client:", err);

    // Gestion des erreurs de duplicatas MongoDB
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const message =
        field === "email"
          ? "Un client avec cet email existe déjà."
          : "Un client avec ce numéro de téléphone existe déjà.";
      return next(createError.conflict(message));
    }

    next(createError.internal("Erreur serveur lors de l'ajout du client."));
  }
};

exports.getAllClients = async (req, res, next) => {
  try {
    const clients = await Client.find();
    res.status(200).json({
      message: "Clients récupérés avec succès.",
      clients: clients,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des clients:", error);
    next(createError.internal("Erreur lors de la récupération des clients."));
  }
};

exports.getClientsByArtist = async (req, res, next) => {
  try {
    const artistId = req.user?._id;

    if (!artistId) {
      return next(createError.unauthorized("Utilisateur non authentifié."));
    }

    const clients = await Client.find({
      artistId,
      isDeletedByArtist: { $ne: true },
    });

    res.status(200).json({
      message: "Clients récupérés avec succès.",
      clients: clients,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des clients:", error);
    next(createError.internal("Erreur lors de la récupération des clients."));
  }
};

exports.updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, ville } = req.body;

    // Validation des données
    try {
      clientService.validateClientData({ nom, prenom, email, telephone });
    } catch (error) {
      return next(createError.badRequest(error.message));
    }

    // Vérification des doublons (exclure le client actuel)
    try {
      await clientService.checkClientDuplicates(email, telephone, id);
    } catch (error) {
      return next(createError.conflict(error.message));
    }

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      {
        nom,
        prenom,
        email,
        telephone:
          telephone && telephone.trim() !== "" ? telephone.trim() : undefined,
        ville,
      },
      { new: true }
    );

    if (!updatedClient) {
      return next(createError.notFound("Client non trouvé."));
    }

    res.status(200).json({
      message: "Client mis à jour avec succès.",
      client: updatedClient,
    });
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du client:", error);
    next(createError.internal("Erreur lors de la mise à jour du client."));
  }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Marquer le client comme supprimé au lieu de le supprimer physiquement
    const deletedClient = await Client.findByIdAndUpdate(
      id,
      { isDeletedByArtist: true },
      { new: true }
    );

    if (!deletedClient) {
      return next(createError.notFound("Client non trouvé."));
    }

    res.status(200).json({
      message: "Client supprimé avec succès.",
      client: deletedClient,
    });
  } catch (error) {
    logger.error("Erreur lors de la suppression du client:", error);
    next(createError.internal("Erreur lors de la suppression du client."));
  }
};
