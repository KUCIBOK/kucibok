/**
 * P3-PERF-003 — Singleton Socket.IO
 *
 * Permet de partager l'instance io entre index.js, bid.controller.js
 * et auctionCronJob.js sans dépendances circulaires.
 *
 * Usage :
 *   // Dans index.js (init)
 *   const { setIO } = require('./utils/socket');
 *   setIO(new Server(httpServer, options));
 *
 *   // Dans un contrôleur
 *   const { getIO } = require('../utils/socket');
 *   getIO()?.to(`auction:${id}`).emit('bid:new', payload);
 */

let _io = null;

function setIO(io) {
  _io = io;
}

/** @returns {import('socket.io').Server|null} */
function getIO() {
  return _io;
}

module.exports = { setIO, getIO };
