const logger = require('../utils/logger');
const Artist = require('../models/Artist');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { createError } = require("../middleware/errorHandler");


exports.createProfile = async (req, res, next) => {
  try {
    const {
      userId,
      username,
      interests,
      institution,
      qualifications,
    } = req.body;

    const existing = await Profile.findOne({ userId });
    if (existing) {
      return next(createError.conflict('Profil déjà existant pour cet utilisateur.'));
    }

    const profile = await Profile.create({
      userId,
      username,
      interests,
      institution,
      qualifications,
    });

    res.status(201).json(profile);
  } catch (error) {
    next(createError.internal("Erreur lors de la création du profil"));
  }
};

exports.getProfileByUserId = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId });
    if (!user) return next(createError.notFound('Utilisateur non trouvé'));
    let profile
    if(user?.role != "artist"){
      profile = await Profile.findOne({ userId: req.params.userId });
    }
    else{
      profile = await Artist.findOne({ userId: req.params.userId });
    }
    res.status(200).json(profile);
  } catch (error) {
    next(createError.internal("Erreur lors de la récupération"));
  }
};


exports.updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId : userId },
      {
        ...req.body,
        image: req?.file ? `${req.protocol}://${req.get('host')}/uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${req.file?.filename}` : req.body.image,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    if (!updatedProfile) return next(createError.notFound('Profil non trouvé'));
    res.status(200).json(updatedProfile);
  }
  catch (error) {
    logger.info(error.message)
    next(createError.internal("Erreur lors de la mise à jour du profil"));
  }
}

exports.deleteProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const deletedProfile = await Profile.findOneAndDelete({ userId : userId });
    if (!deletedProfile) return next(createError.notFound('Profil non trouvé'));
    res.status(200).json({ message: 'Profil supprimé avec succès' });
  }
  catch (error) {
    next(createError.internal("Erreur lors de la suppression du profil"));
  }
}

exports.getAllProfiles = async (req, res, next) => {
  try {
    const profiles = await Profile.find();
    res.status(200).json(profiles);
  } catch (error) {
    next(createError.internal('Erreur lors de la récupération des profils'));
  }
};

exports.deleteAll = async (req, res, next) => {
    try {
        await Profile.deleteMany({})
    } catch (error) {
        return next(createError.internal("Erreur lors de la suppression"));
    }
}