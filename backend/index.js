const http = require('http');
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
const connectDatabase = require("./config/database");
const { config } = require('./config/environnement');
const rateLimit = require("express-rate-limit");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const protect = require('./middleware/api');
const transporter = require("./config/mailerConfig");
const logger = require("./utils/logger"); // P1-SEC-010


// Cron jobs lancés
require("./jobs/auctionCronJob");
require("./jobs/generateCertificates");
require("./jobs/subscriptions.job");
// require("./jobs/analyticsCollectionJob");
require("./jobs/logidooSyncJob");

const artworksRoutes = require("./routes/artwork.routes");
const authRoutes = require("./routes/auth.routes");
const artistRoutes = require("./routes/artist.routes");
const profileRoutes = require("./routes/profile.routes");
const blogPostRoutes = require("./routes/blogPost.routes");
const collectionsRoutes = require("./routes/collection.routes");
const reviewRoutes = require("./routes/review.routes");
const transactionRoutes = require("./routes/transaction.routes");
const auctionRoutes = require("./routes/auction.routes");
const bidRoutes = require("./routes/bid.routes");
const walletRoutes = require("./routes/wallet.routes");
const categoryRoutes = require("./routes/category.routes");
const planRoutes = require("./routes/plan.routes");
const logRoutes = require("./routes/log.routes");
const visitorRoutes = require("./routes/visitor.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const logidooRoutes = require("./routes/logidoo.routes");
// const logidooAlertsRoutes = require("./routes/logidoo.alerts.routes");
const numerisationRoutes = require("./routes/numerisation.routes");
const clientRoutes = require("./routes/client.routes");
const GalleryRoutes = require("./routes/gallery.routes");
const paymentRoutes = require("./routes/payment.routes");
const entityRoutes = require("./routes/entity.routes");
const integrationRoutes = require("./routes/integration.routes");
const professionalAnalyticsRoutes = require("./routes/professionalAnalytics.routes");
const emailMarketingRoutes = require("./routes/emailMarketing.routes");
const contactRoutes = require("./routes/contact.routes");
const campaignRoutes = require("./routes/campaign.routes");
// const crmRoutes = require("./routes/crm.routes");
// const supportTicketRoutes = require("./routes/supportTicket.routes");
// const analyticsRoutes = require("./routes/analytics.routes");


class App {
    app = null;
    server = null;
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorsHandlers();
    }

    initializeMiddlewares(){
        // Headers de sécurité HTTP (P1-SEC-007)
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }, // nécessaire pour /uploads/ publics
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                },
            },
        }));
        this.app.use(express.json({ limit: "10mb" }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(compression());
        this.app.use(
            cors({
                origin: config.cors.origin,
                credentials: false,
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                allowedHeaders: ["Content-Type", "Authorization", "kcb-api-key"],
            })
        );
        // Configuration de la limation de requête
        const limiter = rateLimit({
            windowMs: config.rateLimit.windowMs, //Temps imparti pour le max de requêtes
            max: config.rateLimit.maxRequests, //Maximum de requêtes dans le temps imparti
            message: {
                error: "Trop de requêtes pour cette adresse IP. Réessayez plus tard.",
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use("/api/", limiter); //Mise en place du limiteur pour l'api
        this.app.use((req, res, next) => {
            const { method, url } = req;
            const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
            logger.http(`${method} ${url}`, { ip });
            next()
        })
        this.app.use("/api/health", (req, res, next) => {
            const mongoose = require('mongoose');
            
            return res.status(200).json({
                status: "OK",
                timestamp: new Date().toISOString(),
                environment: config.nodeEnv,
                version: process.env.npm_package_version || "1.0.0",
                services: {
                mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                },
                uptime: process.uptime(),
            });
        });
        logger.info("Middlewares initialisés");
    }

    initializeRoutes(){
      // Middleware API key — appliqué à toutes les routes /api/
      // Les routes logistiques Logidoo sont authentifiées via leur propre middleware
      this.app.use((req, res, next) => {
        if (req.path.startsWith('/api/logistics')) {
          return next();
        }
        protect(req, res, next);
      });

      // P1-SEC-011 — Rate limiter strict pour éviter le spam email admin
      const reportErrorLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: { error: "Trop de signalements. Réessayez dans 15 minutes." },
        standardHeaders: true,
        legacyHeaders: false,
      });

      this.app.post("/api/report-error", reportErrorLimiter, async (req, res, next) => {
        try {
            const { error, errorInfo } = req.body;

            // P1-SEC-011 — Validation et assainissement des inputs
            if (!error || typeof error !== "string") {
              return res.status(400).json({ error: "Champ 'error' manquant ou invalide." });
            }
            const safeError = String(error).slice(0, 1000);
            const safeInfo = errorInfo
              ? JSON.stringify(errorInfo).slice(0, 4000)
              : "(aucune info)";

            await transporter.sendMail({
                from: `"Kucibok Frontend" <${config.adminEmail}>`,
                to: config.adminEmail,
                subject: "[ALERTE FRONTEND] Erreur JS côté client",
                text: `Erreur: ${safeError}\n\nInfo: ${safeInfo}`,
            });
            res.status(200).json({ ok: true });
        } catch (err) {
            console.error("Erreur lors de l'envoi du mail d'alerte frontend:", err);
            res.status(500).json({ error: "Erreur serveur." });
        }
      });
      this.app.use("/api/artworks", artworksRoutes);
      this.app.use("/api/auth", authRoutes);
      this.app.use("/api/artist", artistRoutes);
      this.app.use("/api/profile", profileRoutes);
      this.app.use("/api/blog", blogPostRoutes);
      this.app.use("/api/collection", collectionsRoutes);
      this.app.use("/api/review", reviewRoutes);
      this.app.use("/api/transaction", transactionRoutes);
      this.app.use("/api/auction", auctionRoutes);
      this.app.use("/api/bid", bidRoutes);
      this.app.use("/api/wallet", walletRoutes);
      this.app.use("/api/category", categoryRoutes);
      this.app.use("/api/plan", planRoutes);
      this.app.use("/api/log", logRoutes);
      this.app.use("/api/visitor", visitorRoutes);
      this.app.use("/api/subscription", subscriptionRoutes);
      this.app.use("/api/delivery", deliveryRoutes);
      this.app.use("/api/logistics", logidooRoutes);
      // this.app.use("/api/logistics/alerts", logidooAlertsRoutes);
      this.app.use("/api/numerisation", numerisationRoutes);
      this.app.use("/api/clients", clientRoutes);
      this.app.use("/api/galleries", GalleryRoutes);
      this.app.use("/api/payments", paymentRoutes);
      this.app.use("/api/entities", entityRoutes);
      this.app.use("/api/integrations", integrationRoutes);
      this.app.use("/api/professional-analytics", professionalAnalyticsRoutes);
      this.app.use("/api/email-marketing", emailMarketingRoutes);
      this.app.use("/api/contacts", contactRoutes);
      this.app.use("/api/campaigns", campaignRoutes);
      // this.app.use("/api/crm", crmRoutes);
      // this.app.use("/api/support-tickets", supportTicketRoutes);
      // this.app.use("/api/analytics", analyticsRoutes);

      this.app.use("/uploads", express.static(path.join(__dirname, "public/uploads/")));
      this.app.use("/images", express.static(path.join(__dirname, "public/images/")));
      this.app.use("/certificates", express.static(path.join(__dirname, "public/certificates/")));
      logger.info("Routes initialisées");
    }

    initializeErrorsHandlers() {
        this.app.use(errorHandler);
        this.app.use(notFoundHandler);
        logger.info("Gestion d'erreurs initialisée");
    }

    async start() {
    try {
      // Connection à la base de données
      await connectDatabase();

      // Lancement du serveur
      this.server.listen(config.port, config.host, () => {
        logger.info(`Serveur lancé sur http://${config.host}:${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Interface utilisateur: ${config.cors.origin}`);
        logger.info(`Base de données: ${config.database.uri.replace(/\/\/.*@/, "//***:***@")}`);
      });

      // Arrêt gracieux du serveur
      process.on("SIGINT", this.shutdown.bind(this));
      process.on("SIGTERM", this.shutdown.bind(this));
    } catch (error) {
      logger.error("Échec du démarrage du serveur", { error: error.message, stack: error.stack });
      process.exit(1);
    }
  }

  /**
   * Arrêt gracieux du serveur
   */
  async shutdown() {
    logger.info("Arrêt du serveur en cours...");

    this.server.close(() => {
      logger.info("Serveur arrêté proprement");
      process.exit(0);
    });

    // Forcer à s'arrêter après 10 secondes
    setTimeout(() => {
      logger.error("Le serveur ne s'est pas arrêté dans les délais. Arrêt forcé.");
      process.exit(1);
    }, 10000);
  }
}

const app = new App();
app.start().catch((error) => {
  logger.error("Échec du démarrage de l'application", { error: error.message });
  process.exit(1);
});
