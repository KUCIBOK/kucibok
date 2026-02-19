require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Artist = require("../models/Artist");
const Profile = require("../models/Profile");
const WalletModel = require("../models/Wallet");
const { Wallet } = require("ethers");
const axios = require("axios");
const Transaction = require("../models/Transaction");
const Review = require("../models/Review");
const Collection = require("../models/Collection");
const BlogPost = require("../models/BlogPost");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendUserRegistrationAlertToAdmin,
  sendEmailChangeNotification,
  sendPasswordChangeNotification,
  sendVerificationEmail,
} = require("../services/smtpMailer.service");
const ExcelJS = require("exceljs");
const Artwork = require("../models/Artwork");
const { createError } = require("../middleware/errorHandler");
const {config} = require("../config/environnement");


exports.register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      role,
      name,
      username,
      country,
      telephone,

      // Artist
      biography,
      portfolio,

      // Collector
      interests,

      //Professional
      institution,
      qualifications,
    } = req.body;

    if (!email || !password || !role || !name || !username) {
      return next(createError.badRequest("Champs requis manquants."));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError.conflict("L'utilisateur existe déjà. Essayez de vous connecter."));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const blockchainWallet = Wallet.createRandom();

    // Création du User
    const user = new User({
      email,
      password: hashedPassword,
      role,
      name,
      username,
      country,
      telephone,
      profileCompleted: false,
      isEmailVerified: false,
      isActive: false,
    });
    await user.save();

    const wallet = new WalletModel({
      userId: user._id,
      address: blockchainWallet.address,
      privateKey: blockchainWallet.privateKey,
      balance: 0,
      currency: "ETH",
    });
    await wallet.save();

    let artist = null;
    let profile = null;

    if (role === "artist") {
      artist = new Artist({
        userId: user._id,
        name: name,
        image: req.file
          ? `${req.protocol}://${req.get(
              "host"
            )}/uploads/${new Date().getFullYear()}/${
              new Date().getMonth() + 1
            }/${req.file.filename}`
          : "",
        username: username,
        country: country,
        biography: biography,
        portfolio: portfolio,
        socials: {
          facebook: req.body.facebook || "",
          twitter: req.body.twitter || "",
          instagram: req.body.instagram || "",
        },
      });
      await artist.save();
    } else {
      profile = new Profile({
        userId: user._id,
        username,
        name,
        country,
        interests: interests || "",
        institution: institution || "",
        qualifications: qualifications || "",
      });
      await profile.save();
    }

    try {
      // Envoi du lien de vérification
      const verificationToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      const verifyLink = `${config.cors.origin}/verify-email/${verificationToken}`;
      await sendVerificationEmail(user.email, user.name, verifyLink);
    } catch (error) {
      console.warn("Erreur lors de l'envoi de l'email:", error.message);
    }
    return res.status(201).json({
      user: { ...user.toObject(), password: undefined },
      message: "Compte créé. Vérifiez votre adresse email pour continuer.",
    });
  } catch (err) {
    console.error("Erreur Register:", err);
    return next(createError.internal("Erreur serveur lors de l'inscription."));
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return next(createError.badRequest("Token requis."));

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return next(createError.unauthorized("Token invalide ou expiré."));
    }

    const user = await User.findById(payload.userId);
    if (!user)
      return next(createError.notFound("Utilisateur introuvable."));

    if (user.isEmailVerified) {
      return res.status(200).json({ message: "Email déjà vérifié." });
    }

    console.log("vérif token:", token);
    console.log("payload:", payload);
    console.log("avant save:", user.isEmailVerified);

    user.isEmailVerified = true;
    user.isActive = true;
    await user.save();
    try {
      await sendWelcomeEmail(user?.email, user?.name);
      await sendUserRegistrationAlertToAdmin(user);
    } catch (error) {
      console.warn("Erreur lors de l'envoi de l'alerte:", error.message);
    }
    console.log("après save:", user.isEmailVerified);
    let artist = null;
    let profile = null;
    if (user.role === "artist") {
      artist = await Artist.findOne({ userId: user._id });
    } else {
      profile = await Profile.findOne({ userId: user._id });
    }
    const wallet = await WalletModel.findOne({
      userId: user?.id,
    });

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });
    let plan = null;
    // Si l'utilisateur a un abonnement actif, on récupère le plan associé
    if (subscription?._id) {
      plan = await Plan.findOne({ _id: subscription?.planId });
      if (plan) {
        subscription.plan = plan;
      }
    }

    // Supprime le mot de passe de la réponse
    const { password: _, ...userData } = user.toObject();

    // Génère un token JWT
    const newToken = jwt.sign(
      { ...userData, wallet: wallet, subscription: subscription, plan: plan },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token: newToken,
      artist: artist,
      profile: profile,
    });
  } catch (error) {
    console.error("Erreur vérification email:", error);
    return next(createError.internal("Erreur serveur lors de la vérification email."));
  }
};

exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) return next(createError.badRequest("Email requis."));

    const user = await User.findOne({ email });
    if (!user)
      return next(createError.notFound("Utilisateur introuvable."));

    if (user.isEmailVerified) {
      return next(createError.badRequest("Email déjà vérifié."));
    }

    const verificationToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const verifyLink = `${config.cors.origin}/verify-email/${verificationToken}`;

    await sendVerificationEmail(user.email, user.name, verifyLink);

    return res.status(200).json({
      message: "Un nouvel email de vérification a été envoyé.",
    });
  } catch (err) {
    console.error("Erreur resend email:", err);
    return next(createError.internal("Erreur serveur lors du renvoi de l'email."));
  }
};

// 🔐 Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Recherche de l'utilisateur + récupère le mot de passe (select: false par défaut)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return next(createError.notFound("Email ou mot de passe incorrect"));
    }

    // P1-SEC-013 — Vérification email obligatoire avant connexion
    if (!user.isEmailVerified && user.role !== "admin") {
      return next(createError.forbidden(
        "Veuillez vérifier votre adresse email avant de vous connecter."
      ));
    }

    if (!user?.isActive) {
      return next(createError.unauthorized("Compte suspendu"));
    }
    // Vérifie le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(createError.unauthorized("Email ou mot de passe incorrect"));
    }

    // Mise à jour de la date de dernière connexion
    user.lastLogin = new Date();
    await user.save();

    let artist = null;
    let profile = null;
    if (user.role === "artist") {
      artist = await Artist.findOne({ userId: user._id });
    } else {
      profile = await Profile.findOne({ userId: user._id });
    }
    const wallet = await WalletModel.findOne({
      userId: user?.id,
    });

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });
    let plan = null;
    // Si l'utilisateur a un abonnement actif, on récupère le plan associé
    if (subscription?._id) {
      plan = await Plan.findOne({ _id: subscription?.planId });
      if (plan) {
        subscription.plan = plan;
      }
    }

    // Supprime le mot de passe de la réponse
    const { password: _, ...userData } = user.toObject();

    // Génère un token JWT
    const token = jwt.sign(
      { ...userData, wallet: wallet, subscription: subscription, plan: plan },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token: token,
      artist: artist,
      profile: profile,
      user: {
        ...userData,
        likedArtworks: user.likedArtworks || [],
      },
    });
  } catch (err) {
    return next(createError.internal("Erreur serveur lors de la connexion."));
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, telephone } = req.body;

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return next(createError.conflict("Cet email est déjà utilisé."));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name: name,
      email: email,
      role: role,
      telephone: telephone,
      password: passwordHash,
      isEmailVerified: true,
      isActive: true,
    });
    await user.save();
    const { password: _, ...userData } = user.toObject();
    return res.status(201).json(userData);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password, name, username, country, role, telephone } =
      req.body;

    // Vérifie si l'utilisateur existe
    const user = await User.findOne({ _id: id });
    if (!user) {
      return next(createError.notFound("Utilisateur non trouvé"));
    }
    let oldMail = user.email;
    // Seul un admin peut modifier le rôle (P1-SEC-008 — anti escalade de privilège)
    if (role && req.user?.role !== 'admin') {
      return next(createError.forbidden("Modification du rôle réservée aux administrateurs."));
    }
    // Met à jour les informations de l'utilisateur
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);
    if (name) user.name = name;
    if (username) user.username = username;
    if (telephone) user.telephone = telephone;
    if (country) user.country = country;
    if (role && req.user?.role === 'admin') user.role = role;
    await user.save();

    if (oldMail != user.email) {
      try {
        await sendEmailChangeNotification(oldMail, user.email);
        await sendEmailChangeNotification(user.email, user.email);
      } catch (error) {
        console.error(
          "Erreur lors de l'envoi de la notification de changement d'email:",
          error
        );
      }
    }

    const wallet = await WalletModel.findOne({
      userId: user?._id,
    });

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    let userPlan = null;
    if (subscription?._id) {
      userPlan = await Plan.findOne({ _id: subscription?.planId });
    }
    // Génère un token JWT
    const token = jwt.sign(
      { ...user, wallet: wallet, subscription: subscription, plan: userPlan },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password: _, ...userData } = user.toObject();
    return res.status(200).json({ ...userData, token: token });
  } catch (err) {
    console.error("Erreur Update User:", err.message);
    return next(createError.internal("Erreur serveur lors de la mise à jour."));
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifie si l'utilisateur existe
    const user = await User.findOne({ _id: id }).select("-password");
    if (!user) {
      return next(createError.notFound("Utilisateur non trouvé"));
    }
    const { password: _, ...userData } = user.toObject();
    return res.status(200).json(userData);
  } catch (err) {
    console.error("Erreur Get User:", err.message);
    return next(createError.internal("Erreur serveur lors de la récupération de l'utilisateur."));
  }
};

exports.getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;

    // Vérifie si l'utilisateur existe
    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      return next(createError.notFound("Utilisateur non trouvé"));
    }
    const { password: _, ...userData } = user.toObject();
    return res.status(200).json(userData);
  } catch (err) {
    console.error("Erreur Get User:", err.message);
    return next(createError.internal("Erreur serveur lors de la récupération de l'utilisateur par email."));
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json(users);
  } catch (err) {
    console.error("Erreur Get All Users:", err.message);
    return next(createError.internal("Erreur serveur lors de la récupération des utilisateurs."));
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifie si l'utilisateur existe
    const user = await User.findOne({ _id: id }).select("-password");
    if (!user) {
      return next(createError.notFound("Utilisateur non trouvé"));
    }
    // Supprime l'utilisateur
    await User.findOneAndDelete({ _id: id })
      .then(() => console.log("Utilisateur supprimé"))
      .catch(() => console.log("Erreur lors de la suppression"));

    await Artist.deleteMany({ userId: id })
      .then(() => console.log("Artist supprimé"))
      .catch(() => console.log("Erreur lors de la suppression"));

    await Artwork.deleteMany({ userId: id })
      .then(() => console.log("Oeuvre supprimé"))
      .catch(() => console.log("Erreur lors de la suppression"));

    await Profile.findOneAndDelete({ userId: id })
      .then(() => console.log("Profil supprimé"))
      .catch(() => console.log("Erreur lors de la suppression"));

    await WalletModel.findOneAndDelete({ userId: id })
      .then(() => console.log("Wallet supprimé"))
      .catch(() => console.log("Erreur lors de la suppression"));

    return res.status(200).json(user);
  } catch (err) {
    console.error("Erreur Delete User:", err.message);
    return next(createError.internal("Erreur serveur lors de la suppression de l'utilisateur."));
  }
};

exports.setUserStatus = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (user) {
      user.isActive = !user.isActive;
    }
    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

exports.deleteAllUsers = async (req, res, next) => {
  // P1-SEC-014 — Confirmation explicite obligatoire + transaction atomique
  const { confirm } = req.body;
  if (confirm !== "DELETE_ALL_USERS") {
    return next(createError.badRequest(
      'Confirmation requise : envoyez { "confirm": "DELETE_ALL_USERS" } dans le corps de la requête.'
    ));
  }

  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await User.deleteMany({}, { session });
    await Artist.deleteMany({}, { session });
    await Profile.deleteMany({}, { session });
    await WalletModel.deleteMany({}, { session });
    await Transaction.deleteMany({}, { session });
    await Review.deleteMany({}, { session });
    await BlogPost.deleteMany({}, { session });
    await Collection.deleteMany({}, { session });
    await session.commitTransaction();
    return res
      .status(200)
      .json({ message: "Tous les utilisateurs ont été supprimés avec succès." });
  } catch (err) {
    await session.abortTransaction();
    console.error("Erreur Delete All Users:", err.message);
    return next(createError.internal("Erreur serveur lors de la suppression de tous les utilisateurs."));
  } finally {
    session.endSession();
  }
};

exports.loginWithMetamask = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;

    // Vérifie la signature
    const { verifyMessage } = require("ethers");
    const signerAddress = verifyMessage(message, signature);
    if (signerAddress.toLowerCase() !== address.toLowerCase()) {
      return next(createError.unauthorized("Signature invalide"));
    }

    // Vérifie si l'utilisateur existe déjà
    const user = await User.findOne({
      email: `${address?.slice(0, 6)}@kucibok.com`,
    });
    const users = await User.find();
    console.log(users);
    if (!user) {
      return next(createError.notFound("Utilisateur non trouvé"));
    }
    let artist = null;
    let profile = null;
    let subscription = null;
    let plan = null;

    if (user?.role == "artist") {
      artist = await Artist.findOne({ userId: user?._id });
    } else {
      profile = await Profile.findOne({ userId: user?._id });
    }

    const wallet = await WalletModel.findOne({ userId: user?._id });

    subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    // Si l'utilisateur a un abonnement actif, on récupère le plan associé
    if (subscription?._id) {
      plan = await Plan.findOne({ _id: subscription?.planId });
      if (plan) {
        subscription.plan = plan;
      }
    }
    // Supprime le mot de passe de la réponse
    const { password: _, ...userData } = user.toObject();

    // Génère un token JWT
    const token = jwt.sign(
      { ...userData, wallet: wallet, subscription: subscription, plan: plan },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token: token,
      artist: artist,
      profile: profile,
      user: { ...userData, likedArtworks: user.likedArtworks || [] },
    });
  } catch (err) {
    return next(createError.internal(err.message));
  }
};

exports.signUpWithMetamask = async (req, res, next) => {
  try {
    const { address, signature, message, role } = req.body;
    const signerAddress = verifyMessage(message, signature);
    if (signerAddress.toLowerCase() !== address.toLowerCase()) {
      return next(createError.unauthorized("Signature invalide"));
    }

    // Vérifier l'existence
    const existingUser = await User.findOne({
      email: `${address?.slice(0, 6)}@kucibok.com`,
    });
    if (existingUser) {
      return next(createError.conflict("Cet adresse est déjà utilisé."));
    }

    try {
      const user = new User({
        email: `${address?.slice(0, 6)}@kucibok.com`,
        role: role,
        username: address?.slice(0, 6),
        name: address,
        profileCompleted: false,
      });
      await user.save();

      const wallet = new WalletModel({
        userId: user._id,
        address: address,
        balance: 0,
        currency: "ETH",
      });
      await wallet.save();
      console.log(wallet);

      let artist = null;
      let profile = null;

      if (role == "artist") {
        artist = new Artist({
          userId: user._id,
          name: address,
          username: address,
        });
        await artist.save();
      } else {
        profile = new Profile({
          userId: user?._id,
          name: address,
          username: address,
        });
        await profile.save();
        console.log(profile);
      }
      // Supprime le mot de passe de la réponse
      const { password: _, ...userData } = user.toObject();
      console.log(user);
      // Génère un token JWT
      const token = jwt.sign(
        { ...userData, wallet: wallet },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: "Inscrption réussie",
        token: token,
        artist: artist,
        profile: profile,
      });
    } catch (error) {
      return next(createError.internal(error.message));
    }
  } catch (error) {
    return next(createError.internal(error.message));
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req?.user?._id }).select(
      "+password"
    );
    if (!user)
      return next(createError.notFound("Utilisateur introuvable"));
    const { oldPassword, newPassword } = req.body;
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return next(createError.unauthorized("Mot de passe incorrect"));
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    const { password: _, ...userData } = user.toObject();
    try {
      await sendPasswordChangeNotification(user?.email);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification de changement de mot de passe:",
        error
      );
    }
    return res.json({ ...userData });
  } catch (error) {
    console.log(error.message);
    return next(createError.internal("Erreur serveur lors du changement de mot de passe."));
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(createError.badRequest("Email requis."));

    const user = await User.findOne({ email });
    if (!user)
      return next(createError.notFound("Aucun utilisateur trouvé avec cet email."));

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const resetLink = `${config.cors.origin}/reset-password/${token}`;

    try{
      await sendPasswordResetEmail(user.email, resetLink);
    }catch (error){
      console.error("Erreur lors de l'envoi de l'email de réinitialisation:", error);
      return next(createError.internal("Erreur lors de l'envoi de l'email de réinitialisation."));
    }

    return res
      .status(200)
      .json({ message: "Email de réinitialisation envoyé." });
  } catch (error) {
    console.error("Erreur forgotPassword:", error);
    return next(createError.internal("Erreur serveur lors de la réinitialisation du mot de passe."));
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return next(createError.badRequest("Token et nouveau mot de passe requis."));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return next(createError.unauthorized("Token invalide ou expiré."));
    }

    const user = await User.findById(payload.userId).select("+password");
    if (!user) {
      return next(createError.notFound("Utilisateur introuvable."));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    try {
      await sendPasswordChangeNotification(user?.email);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification de changement de mot de passe:",
        error
      );
    }
    return res
      .status(200)
      .json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    console.error("Erreur resetPassword:", error);
    return next(createError.internal("Erreur serveur lors de la réinitialisation du mot de passe."));
  }
};

exports.exportDataOnExcelFormat = async (req, res, next) => {
  try {
    const users = await User.find();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Utilisateurs");

    worksheet.columns = [
      { header: "Nom", key: "name", width: 30 },
      { header: "Email", key: "email", width: 25 },
      { header: "Date de création", key: "createdAt", width: 20 },
      { header: "Rôle", key: "role", width: 15 },
      { header: "Pays", key: "country", width: 20 },
      { header: "Téléphone", key: "telephone", width: 15 },
      { header: "Dernière connexion", key: "lastLogin", width: 20 },
      { header: "Statut actif", key: "isActive", width: 15 },
    ];

    const artists = users?.filter((item) => item?.role == "artist");
    const collectors = users?.filter((item) => item?.role == "collector");
    const professionals = users?.filter((item) => item?.role == "professional");

    artists?.forEach((user) => {
      worksheet.addRow({
        name: user?.name,
        email: user?.email,
        createdAt: user?.createdAt?.toLocaleDateString(),
        role:
          user?.role == "artist"
            ? "Artiste"
            : user?.role == "collector"
            ? "Collectionneur"
            : user?.role == "professional"
            ? "Professionnel"
            : "Administrateur",
        country: user?.country,
        telephone: user?.telephone,
        lastLogin: user?.lastLogin?.toLocaleDateString(),
        isActive: user?.isActive ? "Actif" : "Suspendu",
      });
    });

    collectors?.forEach((user) => {
      worksheet.addRow({
        name: user?.name,
        email: user?.email,
        createdAt: user?.createdAt?.toLocaleDateString(),
        role:
          user?.role == "artist"
            ? "Artiste"
            : user?.role == "collector"
            ? "Collectionneur"
            : user?.role == "professional"
            ? "Professionnel"
            : "Administrateur",
        country: user?.country,
        telephone: user?.telephone,
        lastLogin: user?.lastLogin?.toLocaleDateString(),
        isActive: user?.isActive ? "Actif" : "Suspendu",
      });
    });

    professionals?.forEach((user) => {
      worksheet.addRow({
        name: user?.name,
        email: user?.email,
        createdAt: user?.createdAt?.toLocaleDateString(),
        role:
          user?.role == "artist"
            ? "Artiste"
            : user?.role == "collector"
            ? "Collectionneur"
            : user?.role == "professional"
            ? "Professionnel"
            : "Administrateur",
        country: user?.country,
        telephone: user?.telephone,
        lastLogin: user?.lastLogin?.toLocaleDateString(),
        isActive: user?.isActive ? "Actif" : "Suspendu",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Utilisateurs.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
    return;
  } catch (error) {
    console.error("Erreur export data:", error);
    return next(createError.internal("Erreur serveur lors de l'export des données."));
  }
};
