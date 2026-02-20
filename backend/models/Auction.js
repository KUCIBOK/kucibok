// models/Auction.js
const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artwork",
    required: true,
    unique: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  currentPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ["upcoming", "ongoing", "ended", "cancelled"],
    default: "upcoming",
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  bids: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
    },
  ],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// P3-PERF-006 — Index composés pour le cron et les requêtes list
// Cron upcoming → ongoing  : { status, startTime }
// Cron ongoing  → ended    : { status, endTime }
// Bid controller            : { status, endTime, currentPrice }
auctionSchema.index({ status: 1, startTime: 1 });
auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ status: 1, endTime: 1, currentPrice: 1 });

module.exports = mongoose.model("Auction", auctionSchema);
