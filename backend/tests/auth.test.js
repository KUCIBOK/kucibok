/**
 * P5-TEST-001 — Tests d'intégration : authentification
 *
 * Couvre :
 *  - POST /api/auth/login : validation des champs, credentials, email non vérifié
 *  - POST /api/auth/register : champs requis manquants
 *  - Middleware requireRole() : token absent, invalide, utilisateur introuvable, compte suspendu
 *  - Sécurité API key : requêtes sans clé ou mauvaise clé → 401
 */

const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocks AVANT l'import de l'app (Jest hoist jest.mock() automatiquement)
jest.mock("../models/User");
jest.mock("../models/Artist");
jest.mock("../models/Profile");
jest.mock("../models/Wallet");
jest.mock("../models/Subscription");
jest.mock("../models/Plan");
jest.mock("../services/smtpMailer.service");
jest.mock("bcryptjs");
jest.mock("ethers", () => ({
  Wallet: { createRandom: jest.fn(() => ({ address: "0xtest", privateKey: "0xpk" })) },
}));

const User   = require("../models/User");
const bcrypt = require("bcryptjs");
const app    = require("./helpers/testApp");

const API_KEY = process.env.API_KEY;

/** Header avec API key */
const apiHeaders = (extra = {}) => ({ "kcb-api-key": API_KEY, ...extra });

/** Crée un JWT de test */
const makeToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

// ---------------------------------------------------------------------------
describe("Security — API Key middleware", () => {
  it("renvoie 401 sans API key", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "pass" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/API key/i);
  });

  it("renvoie 401 avec une mauvaise API key", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set({ "kcb-api-key": "wrong-key" })
      .send({ email: "a@b.com", password: "pass" });
    expect(res.status).toBe(401);
  });

  it("passe avec la bonne API key", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/login")
      .set(apiHeaders())
      .send({ email: "ghost@test.com", password: "pass" });
    // La requête dépasse le middleware API key (401 serait du middleware, pas 400/401 du controller)
    expect(res.status).not.toBe(401); // pas bloqué par API key
  });
});

// ---------------------------------------------------------------------------
// Helpers pour mock chainable : User.findOne({ email }).select("+password")
const mockFindOneUser = (user) =>
  User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

/** Simule un utilisateur complet avec méthodes Mongoose nécessaires au login */
const makeUser = (overrides = {}) => ({
  _id: "uid-test",
  email: "user@test.com",
  password: "hashed_pass",
  isEmailVerified: true,
  isActive: true,
  role: "collector",
  lastLogin: null,
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({ _id: "uid-test", email: "user@test.com", role: "collector" }),
  ...overrides,
});

describe("POST /api/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  // Note : le controller login ne valide pas les champs manquants avant la requête DB.
  // Il passe directement à User.findOne({ email }).select("+password").
  // → email undefined → findOne({}) → résultat du mock.

  it("renvoie 404 si utilisateur introuvable en DB", async () => {
    // Mock chaînable : findOne().select() retourne null
    mockFindOneUser(null);
    const res = await request(app)
      .post("/api/auth/login")
      .set(apiHeaders())
      .send({ email: "ghost@test.com", password: "pass123" });
    expect(res.status).toBe(404);
  });

  it("renvoie 403 si email non vérifié (rôle non-admin)", async () => {
    mockFindOneUser(makeUser({ isEmailVerified: false }));
    const res = await request(app)
      .post("/api/auth/login")
      .set(apiHeaders())
      .send({ email: "unverified@test.com", password: "pass123" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/email/i);
  });

  it("renvoie 401 si compte suspendu (isActive = false)", async () => {
    mockFindOneUser(makeUser({ isEmailVerified: true, isActive: false }));
    const res = await request(app)
      .post("/api/auth/login")
      .set(apiHeaders())
      .send({ email: "suspended@test.com", password: "pass123" });
    expect(res.status).toBe(401);
  });

  it("renvoie 401 si mot de passe incorrect", async () => {
    mockFindOneUser(makeUser({ isEmailVerified: true, isActive: true }));
    bcrypt.compare.mockResolvedValue(false);
    const res = await request(app)
      .post("/api/auth/login")
      .set(apiHeaders())
      .send({ email: "user@test.com", password: "wrongpass" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe("POST /api/auth/register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renvoie 400 si champs requis manquants (pas d'email)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set(apiHeaders())
      .send({ password: "pass", role: "collector", name: "Test", username: "test" });
    expect(res.status).toBe(400);
  });

  it("renvoie 409 si utilisateur déjà existant", async () => {
    User.findOne.mockResolvedValue({ _id: "existing-user" });
    const res = await request(app)
      .post("/api/auth/register")
      .set(apiHeaders())
      .send({
        email: "exists@test.com",
        password: "pass123",
        role: "collector",
        name: "Existing",
        username: "existing",
      });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe("Middleware requireRole() — route protégée GET /api/auth/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renvoie 401 si aucun token fourni", async () => {
    const res = await request(app)
      .get("/api/auth/some-user-id")
      .set(apiHeaders());
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token/i);
  });

  it("renvoie 401 avec Authorization: Bearer null", async () => {
    const res = await request(app)
      .get("/api/auth/some-user-id")
      .set(apiHeaders({ Authorization: "Bearer null" }));
    expect(res.status).toBe(401);
  });

  it("renvoie 401 avec un token JWT invalide", async () => {
    const res = await request(app)
      .get("/api/auth/some-user-id")
      .set(apiHeaders({ Authorization: "Bearer this.is.invalid" }));
    expect(res.status).toBe(401);
  });

  it("renvoie 401 si l'utilisateur du token n'existe plus en DB", async () => {
    const token = makeToken({ _id: "uid-ghost", role: "collector", email: "ghost@test.com" });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .get("/api/auth/some-user-id")
      .set(apiHeaders({ Authorization: `Bearer ${token}` }));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/introuvable/i);
  });

  it("renvoie 403 si le compte est suspendu (isActive = false)", async () => {
    const token = makeToken({ _id: "uid-sus", role: "collector", email: "sus@test.com" });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "uid-sus",
        isActive: false,
        role: "collector",
      }),
    });
    const res = await request(app)
      .get("/api/auth/some-user-id")
      .set(apiHeaders({ Authorization: `Bearer ${token}` }));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspendu/i);
  });

  it("renvoie 403 si rôle insuffisant (collector sur route admin)", async () => {
    const token = makeToken({ _id: "uid-collector", role: "collector", email: "c@test.com" });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "uid-collector",
        isActive: true,
        role: "collector",
      }),
    });
    // GET / est une route admin (getAllUsers)
    const res = await request(app)
      .get("/api/auth/")
      .set(apiHeaders({ Authorization: `Bearer ${token}` }));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/rôle/i);
  });
});
