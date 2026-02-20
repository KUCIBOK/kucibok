/**
 * P5-TEST-001 — Application Express minimale pour les tests
 *
 * Identique à l'app de production (mêmes routes, middlewares, errorHandler)
 * sans :
 *   - connexion MongoDB (évitée via jest.mock sur les models)
 *   - démarrage du serveur HTTP (géré par supertest)
 *   - cron jobs (imports retirés)
 *   - socket.io (non nécessaire pour les tests HTTP)
 *
 * Usage :
 *   const request = require('supertest');
 *   const app = require('./helpers/testApp');
 *   await request(app).post('/api/auth/login').send({...});
 */

// Variables d'environnement pour les tests
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-kucibok-2026";
process.env.API_KEY = "test-api-key-12345";
process.env.VITE_API_KEY = "test-api-key-12345";

const express = require("express");
const protect = require("../../middleware/api");
const { errorHandler, notFoundHandler } = require("../../middleware/errorHandler");

// Routes testées
const authRoutes    = require("../../routes/auth.routes");
const bidRoutes     = require("../../routes/bid.routes");
const auctionRoutes = require("../../routes/auction.routes");

const app = express();
app.use(express.json());

// API key — même logique qu'en prod (sauf /api/logistics)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/logistics")) return next();
  protect(req, res, next);
});

app.use("/api/auth",     authRoutes);
app.use("/api/bids",     bidRoutes);
app.use("/api/auctions", auctionRoutes);

app.use(errorHandler);
app.use(notFoundHandler);

module.exports = app;
