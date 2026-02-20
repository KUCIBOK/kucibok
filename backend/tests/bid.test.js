/**
 * P5-TEST-001 — Tests d'intégration : enchères (placeBid)
 *
 * Couvre :
 *  - POST /api/bids sans token → 401
 *  - Enchère introuvable → 404
 *  - Enchère non active (upcoming / ended) → 400
 *  - Vendeur tente d'enchérir sur sa propre enchère → 403
 *  - Montant inférieur au minimum requis (currentPrice + minBidIncrement) → 400
 *  - Montant exact au minimum requis → passe la validation (findOneAndUpdate mocké)
 */

const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Auction");
jest.mock("../models/Bid");
jest.mock("../models/User");

const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const app = require("./helpers/testApp");

const API_KEY = process.env.API_KEY;

/** Helper : headers avec API key */
const apiHeaders = (extra = {}) => ({ "kcb-api-key": API_KEY, ...extra });

/** Helper : crée un JWT de test pour userId donné */
const makeToken = (userId = "bidder-id", role = "collector") =>
  jwt.sign({ _id: userId, role, email: `${userId}@test.com` }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

/** Helper : mock l'utilisateur authentifié dans le middleware */
const mockAuthUser = (userId, role = "collector") => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: userId,
      role,
      isActive: true,
    }),
  });
};

/** Helper : mock Auction.findById avec un document d'enchère de test */
const mockAuction = (overrides = {}) => {
  const now = new Date();
  const base = {
    _id: "auction-test-id",
    status: "ongoing",
    startTime: new Date(now.getTime() - 3_600_000), // -1h (démarrée)
    endTime:   new Date(now.getTime() + 3_600_000), // +1h (pas encore terminée)
    seller:    { toString: () => "seller-id" },
    currentPrice:    1000,
    minBidIncrement:   50, // minimum requis = 1050
    ...overrides,
  };
  Auction.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(base) });
  return base;
};

// ---------------------------------------------------------------------------
describe("POST /api/bids — Authentification", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renvoie 401 sans token JWT", async () => {
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders())
      .send({ auctionId: "auction1", amount: 1100 });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe("POST /api/bids — Validations métier", () => {
  const BIDDER = "bidder-test-id";

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser(BIDDER);
  });

  it("renvoie 404 si l'enchère n'existe pas", async () => {
    Auction.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "nonexistent-id", amount: 1100 });
    expect(res.status).toBe(404);
  });

  it("renvoie 400 si l'enchère est de statut upcoming (pas encore active)", async () => {
    const now = new Date();
    mockAuction({
      status: "upcoming",
      startTime: new Date(now.getTime() + 3_600_000), // démarre dans 1h
    });
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active/i);
  });

  it("renvoie 400 si l'enchère est de statut ended", async () => {
    const now = new Date();
    mockAuction({
      status: "ended",
      endTime: new Date(now.getTime() - 3_600_000), // terminée il y a 1h
    });
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1100 });
    expect(res.status).toBe(400);
  });

  it("renvoie 403 si le vendeur tente d'enchérir sur sa propre enchère", async () => {
    const SELLER = "the-seller-id";
    mockAuthUser(SELLER);
    mockAuction({ seller: { toString: () => SELLER } });
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(SELLER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1100 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/propre enchère/i);
  });

  it("renvoie 400 si amount < currentPrice + minBidIncrement", async () => {
    mockAuction({ currentPrice: 1000, minBidIncrement: 50 }); // min = 1050
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1040 }); // 1040 < 1050
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("1050"); // message mentionne le minimum
  });

  it("renvoie 400 si amount = currentPrice (pas d'incrément)", async () => {
    mockAuction({ currentPrice: 1000, minBidIncrement: 50 }); // min = 1050
    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1000 }); // égal, pas supérieur
    expect(res.status).toBe(400);
  });

  it("renvoie 201 si amount >= currentPrice + minBidIncrement (offre valide)", async () => {
    mockAuction({ currentPrice: 1000, minBidIncrement: 50 }); // min = 1050

    // Mock findOneAndUpdate — retourne un document (l'offre passe la garde atomique)
    Auction.findOneAndUpdate.mockResolvedValue({ _id: "auction-test-id", currentPrice: 1000 });
    Auction.updateOne.mockResolvedValue({});

    // Mock Bid.prototype.save
    const mockBidInstance = {
      _id: "bid-new-id",
      auction: "auction-test-id",
      bidder: BIDDER,
      amount: 1100,
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };
    Bid.mockImplementation(() => mockBidInstance);

    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1100 }); // 1100 >= 1050 ✅
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/succès/i);
  });

  it("renvoie 409 si une offre concurrente passe en premier (findOneAndUpdate retourne null)", async () => {
    mockAuction({ currentPrice: 1000, minBidIncrement: 50 });

    // findOneAndUpdate retourne null → offre concurrente plus élevée
    Auction.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/bids")
      .set(apiHeaders({ Authorization: `Bearer ${makeToken(BIDDER)}` }))
      .send({ auctionId: "auction-test-id", amount: 1100 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/simultanément/i);
  });
});
