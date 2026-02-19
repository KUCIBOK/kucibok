# ROADMAP KUCIBOK — Audit Complet & Plan de Remédiation

**Version:** 1.1 | **Date:** 19 février 2026 | **Statut:** Phase 0 complète ✅ — Phase 1 en cours

> Ce document est le résultat d'un audit senior couvrant : Sécurité, Scalabilité, Performance, UX/UI, Logique Métier, Architecture, et Tests Unitaires.

---

## RÉSUMÉ EXÉCUTIF

### Score de risque global : CRITIQUE — 2.1 / 10

Le projet est une plateforme de vente d'art africain avec enchères, wallets Ethereum, et paiements réels (PayDunya). L'audit révèle un état **non déployable en l'état**. Plusieurs vulnérabilités de niveau critique ont été confirmées directement dans le code source.

### Tableau des vulnérabilités critiques confirmées

| # | Vecteur | Gravité | Fichier / Preuve |
|---|---|---|---|
| 1 | Credentials MongoDB en clair dans Git | 🔴 CRITIQUE | `backend/.env:17` |
| 2 | Backdoor admin hardcodée active en production | 🔴 CRITIQUE | `backend/index.js:173` — `admin@kucibok.com / admin123` |
| 3 | JWT Logidoo hardcodé donnant accès service | 🔴 CRITIQUE | `backend/middleware/auth.js:8` |
| 4 | Clés privées ETH stockées en clair dans MongoDB | 🔴 CRITIQUE | `backend/models/Wallet.js:16` |
| 5 | Données bancaires (cardNumber, cvc) en clair | 🔴 CRITIQUE | `backend/models/User.js:38-51` |
| 6 | Frontend appelle la backdoor, pas le vrai login | 🔴 CRITIQUE | `frontend/src/api/useAuth.js:11` |
| 7 | Race condition sur les enchères (double bid) | 🟠 HAUTE | `backend/controllers/bid.controller.js:36-49` |
| 8 | Double paiement PayDunya possible | 🟠 HAUTE | `backend/controllers/payment.controller.js:142` |
| 9 | Escalade de privilège via updateUser | 🟠 HAUTE | `backend/controllers/auth.controllers.js:390` |
| 10 | Mot de passe loggué en clair côté frontend | 🟠 HAUTE | `frontend/src/api/useAuth.js:8` |

---

## LÉGENDE

- 🔴 **P0** — Urgence absolue (bloquer tout déploiement)
- 🟠 **P1** — Critique (semaine 1-2)
- 🟡 **P2** — Haute (semaine 3-4)
- 🟢 **P3** — Moyenne (semaine 5-6)
- 🔵 **P4** — Normale (semaine 7)
- ⚪ **P5** — Faible (semaine 8-9)

**Statuts :** `[ ]` À faire · `[x]` Fait · `[-]` En cours · `[~]` Reporté

---

## PHASE 0 — URGENCES ABSOLUES

> À traiter IMMÉDIATEMENT, avant tout autre changement. Chaque heure de délai représente un risque de compromission totale.

### [P0-SEC-001] 🔴 Rotation immédiate de TOUS les secrets compromis
- [~] **Statut :** Partiel — `.gitignore` et `.env.exemple` nettoyés ✅ — Rotation dans les services externes à faire manuellement
- **Fichiers :** `backend/.env`, `backend/.env.production`, `frontend/.env`
- **Problème :** Les fichiers `.env` sont commités dans Git. L'historique conserve ces données même après suppression.
- **Actions :**
  1. MongoDB Atlas : changer le password du user `aureliuskolani` (URI : `mongodb+srv://aureliuskolani:***@kucibok.mmnychn.mongodb.net`)
  2. Resend API : invalider la clé depuis le dashboard Resend
  3. Hostinger Email : changer le mot de passe
  4. SMTP Brevo : invalider depuis le dashboard
  5. PayDunya Live Keys : invalider et régénérer, vérifier l'historique des transactions
  6. JWT Secret : générer un nouveau (`openssl rand -hex 64`) — invalide tous les tokens actifs
  7. Purger l'historique Git : utiliser `git filter-repo` ou BFG Repo-Cleaner
  8. Ajouter `.env*`, `.env.production`, `.env.local` dans tous les `.gitignore`

---

### [P0-SEC-002] 🔴 Supprimer les endpoints de bypass en production
- [x] **Statut :** Fait — commit `180778c` — branche `fix/phase-0-bypass-cors-logidoo`
- **Fichiers :** `backend/index.js:122-203`, `frontend/src/api/useAuth.js:11`
- **Problème :** `/api/auth/login-bypass` accepte `admin@kucibok.com / admin123` (hardcodé). Le frontend appelle cette backdoor au lieu du vrai endpoint `/api/auth/login`.
- **Actions :**
  1. Supprimer le bloc `register-bypass` (`index.js:122-153`)
  2. Supprimer le bloc `login-bypass` (`index.js:167-203`)
  3. Modifier `useAuth.js:11` : remplacer `/auth/login-bypass` → `/auth/login`
  4. Supprimer la logique bypass dans `middleware/auth.js:4-6, 37-48, 88-98`
  5. Activer la vérification email commentée (`auth.controllers.js:275-280`)

---

### [P0-SEC-003] 🔴 Supprimer le JWT Logidoo hardcodé dans le source
- [x] **Statut :** Fait — commit `180778c` — auth.js refactorisé en `requireRole()` factory
- **Fichiers :** `backend/middleware/auth.js:8`
- **Problème :** Un JWT RSA256 complet est hardcodé. Quiconque possède ce token (visible dans le code) accède à tous les endpoints `auth` et `admin` sans vérification DB.
- **Actions :**
  1. Supprimer la constante `LOGIDOO_API_KEY`
  2. Supprimer les blocs `if (token === LOGIDOO_API_KEY)` dans les 5 fonctions middleware
  3. Remplacer par un secret en variable d'environnement `LOGIDOO_SERVICE_SECRET` avec vérification HMAC

---

### [P0-SEC-004] 🔴 Chiffrer les clés privées Ethereum en base de données
- [x] **Statut :** Fait — commit `b146496` — utils/encryption.js AES-256-GCM + hook Wallet pre('save') + script migration
- **Fichiers :** `backend/models/Wallet.js:16-20`, `backend/controllers/auth.controllers.js:64-88`
- **Problème :** La `privateKey` ETH est stockée en clair dans MongoDB. Tout accès DB compromet tous les wallets.
- **Actions :**
  1. Migrer les clés existantes en base avec AES-256-GCM
  2. Ajouter un hook Mongoose `pre('save')` pour chiffrer/déchiffrer via `WALLET_ENCRYPTION_KEY` en env
  3. Ne jamais retourner `privateKey` dans aucune réponse API
  4. À terme : migrer vers AWS KMS ou HashiCorp Vault

---

### [P0-SEC-005] 🔴 Supprimer les données bancaires du modèle User
- [x] **Statut :** Fait — commit `53342fa` — schéma User nettoyé + script migration MongoDB
- **Fichiers :** `backend/models/User.js:38-51`
- **Problème :** Champs `card.cardNumber`, `card.cvc`, `card.expiry` stockés en clair → violation PCI-DSS.
- **Actions :**
  1. Supprimer les champs `card` du schéma `User`
  2. Migration : `db.users.updateMany({}, { $unset: { card: "" } })`
  3. Ne jamais stocker de PAN — utiliser exclusivement les tokens de paiement PayDunya

---

### [P0-SEC-006] 🔴 Corriger la configuration CORS (double enregistrement)
- [x] **Statut :** Fait — commit `180778c` — suppression cors() ouvert + bodyParser + express.json() doublons
- **Fichiers :** `backend/index.js:68-82`
- **Problème :** `cors()` appelé 2 fois (ouvert à tout, puis restreint). `express.json()` appelé 2 fois. `bodyParser.json()` redondant.
- **Actions :**
  1. Supprimer le premier `this.app.use(cors())` (`index.js:72`)
  2. Supprimer `this.app.use(express.json())` en doublon (`index.js:69`)
  3. Supprimer `this.app.use(bodyParser.json())` (redondant avec `express.json()`)

---

### [P0-UX-001] 🔴 Supprimer le `window.close()` déclenché par le redimensionnement
- [x] **Statut :** Fait — commit `067257f` — handleResize et window.close() supprimés d'App.jsx
- **Fichiers :** `frontend/src/App.jsx:53-61`
- **Problème :** Ferme l'onglet utilisateur si `outerWidth - innerWidth > 100` (DevTools ouverts, panneau latéral, certains moniteurs).
- **Action :** Supprimer entièrement le handler `handleResize` et son `addEventListener`.

---

### [P0-UX-002] 🔴 Supprimer le log du mot de passe en clair dans la console
- [x] **Statut :** Fait — commit `180778c` — console.log(email, password) supprimés de useAuth.js
- **Fichiers :** `frontend/src/api/useAuth.js:8-9`
- **Problème :** `console.log("Attempting login with:", email, password)` — mot de passe visible dans la console navigateur.
- **Action :** Supprimer les lignes 8-9 et 17 de `useAuth.js`.

---

## PHASE 1 — CORRECTIONS CRITIQUES DE SÉCURITÉ (Semaine 1-2)

### [P1-SEC-007] 🟠 Installer et configurer Helmet.js
- [ ] **Statut :** À faire
- **Fichiers :** `backend/index.js`, `backend/package.json`
- **Problème :** Aucun header HTTP de sécurité (X-Frame-Options, HSTS, CSP, X-XSS-Protection).
- **Actions :**
  1. `npm install helmet` dans le backend
  2. Ajouter `this.app.use(helmet())` comme premier middleware
  3. Configurer CSP pour autoriser uniquement les origines connues

---

### [P1-SEC-008] 🟠 Bloquer l'escalade de privilège dans updateUser
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:390`, `backend/routes/auth.routes.js:57`
- **Problème :** N'importe quel utilisateur authentifié peut envoyer `PUT /api/auth/:id` avec `{ "role": "admin" }`.
- **Actions :**
  1. Ajouter : `if (role && req.user.role !== 'admin') return next(createError.forbidden(...))`
  2. Créer un endpoint dédié `PATCH /api/auth/:id/role` protégé par `admin` middleware

---

### [P1-SEC-009] 🟠 Protéger les endpoints getUserById et getUserByEmail
- [ ] **Statut :** À faire
- **Fichiers :** `backend/routes/auth.routes.js:40, 46`
- **Problème :** `GET /:id` et `GET /email/:email` sans authentification exposent les données utilisateurs.
- **Actions :**
  1. Ajouter le middleware `auth` sur ces routes — ou limiter les champs retournés aux données publiques `{ name, role, createdAt }`
  2. Rate-limit spécifique sur `/resend-verification-email` (max 3/h par IP)

---

### [P1-SEC-010] 🟠 Supprimer les logs verbeux en production
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:170-171`, `backend/controllers/payment.controller.js:145`, `frontend/src/api/useAuth.js:8-9,17,24`
- **Actions :**
  1. Installer `winston` ou `pino` comme logger structuré
  2. Remplacer tous les `console.log/debug` sensibles par des appels logger avec niveau configurable
  3. En production : niveau minimum `warn`

---

### [P1-SEC-011] 🟠 Sécuriser l'endpoint `/api/report-error`
- [ ] **Statut :** À faire
- **Fichiers :** `backend/index.js:205-221`
- **Problème :** Endpoint POST public non authentifié → spam email admin, déni de service.
- **Actions :**
  1. Ajouter le middleware `auth`
  2. Ajouter un rate-limit spécifique : max 5 req/IP/heure
  3. Sanitiser `error` et `errorInfo` avant envoi email

---

### [P1-SEC-012] 🟠 Corriger la validation MIME des uploads
- [ ] **Statut :** À faire
- **Fichiers :** `backend/middleware/multer.js`
- **Problème :** Vérification basée sur `file.mimetype` (fourni par le client, spoofable). Un `.php` ou `.js` peut être uploadé avec `mimetype: "image/jpeg"`.
- **Actions :**
  1. Installer `file-type` (détection par signature des octets)
  2. Vérifier la signature réelle dans le `fileFilter` de Multer
  3. Générer un UUID + extension validée comme nom de fichier
  4. Servir `/uploads/` avec `Content-Disposition: attachment`

---

### [P1-SEC-013] 🟠 Activer la vérification email
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:275-280`
- **Problème :** La vérification email est commentée. Tout utilisateur peut se connecter sans vérifier son adresse.
- **Action :** Décommenter le bloc de vérification. Tester le flux complet avant activation.

---

### [P1-SEC-014] 🟠 Sécuriser `deleteAllUsers`
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:526-538`
- **Problème :** Supprime tout sans transaction MongoDB. Une interruption laisse la DB dans un état incohérent.
- **Actions :**
  1. Exiger un body `{ confirm: "DELETE_ALL_USERS" }` obligatoire
  2. Envelopper dans une session MongoDB avec transaction
  3. Ajouter un log d'audit avec l'identité de l'admin
  4. Envisager de retirer cet endpoint de production

---

### [P1-SEC-015] 🟠 Implémenter l'idempotence sur les callbacks PayDunya
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/payment.controller.js:142-172`
- **Problème :** Pas de vérification de signature webhook, pas d'idempotence → double traitement possible.
- **Actions :**
  1. Vérifier la signature HMAC du webhook PayDunya
  2. Vérifier `if (transaction.paymentStatus === 'completed') return res.status(200).json({ ok: true })`
  3. Utiliser une collection `ProcessedWebhooks` avec index unique sur `transactionId`
  4. Corriger l'appel `this.processArtworkPurchase` → `exports.processArtworkPurchase`

---

### [P1-SEC-016] 🟠 Conformité RGPD — Consentement pour le tracking IP
- [ ] **Statut :** À faire
- **Fichiers :** `frontend/src/App.jsx:64-89`
- **Problème :** Collecte IP + user agent sans consentement via `api.ipify.org` à chaque visite.
- **Actions :**
  1. Implémenter une bannière de consentement (CMP)
  2. Déclencher `addVisitor()` uniquement après consentement explicite
  3. Anonymiser l'IP (masquer le dernier octet) avant stockage

---

## PHASE 2 — ARCHITECTURE ET QUALITÉ (Semaine 3-4)

### [P2-ARCH-001] 🟡 Refactoriser le middleware d'authentification
- [ ] **Statut :** À faire
- **Fichiers :** `backend/middleware/auth.js` (180 lignes, 5 fonctions quasi-identiques)
- **Plan :**
  ```
  authenticate(req)         // logique commune d'extraction + vérification JWT
    → requireAuth           // middleware: authentifié seulement
    → requireRole(...roles) // factory: requireRole('admin')
    → requireAdmin          // alias: requireRole('admin')
    → requireArtist         // alias: requireRole('artist', 'admin')
  ```

---

### [P2-ARCH-002] 🟡 Supprimer les dépendances serveur du frontend
- [ ] **Statut :** À faire
- **Fichiers :** `frontend/package.json`
- **Problème :** `express`, `nodemailer`, `next` dans les dépendances frontend → bundle de production gonflé.
- **Actions :**
  1. Supprimer `express`, `nodemailer`, `next` de `frontend/package.json`
  2. Vérifier qu'ils ne sont importés nulle part dans `src/`
  3. Analyser le bundle avec `vite-bundle-analyzer`

---

### [P2-ARCH-003] 🟡 Isoler le code de développement hors du serveur principal
- [ ] **Statut :** À faire
- **Fichiers :** `backend/index.js:122-203`
- **Actions :**
  1. Extraire en `backend/routes/dev.routes.js`
  2. Enregistrer uniquement si `config.nodeEnv === 'development'`
  3. Test CI : en production, `GET /api/auth/login-bypass` doit retourner 404

---

### [P2-ARCH-004] 🟡 Activer et configurer Redis
- [ ] **Statut :** À faire
- **Fichiers :** `backend/config/environnement.js:26-28`
- **Problème :** Redis configuré mais jamais utilisé.
- **Usages cibles :**
  - Cache `GET /api/artworks` (TTL 5 min)
  - Cache profils artistes
  - Blacklist JWT (tokens révoqués)
  - Rate-limiting distribué

---

### [P2-ARCH-005] 🟡 Standardiser la gestion des erreurs async (Express 5)
- [ ] **Statut :** À faire
- **Fichiers :** Tous les controllers
- **Note :** Express 5 gère nativement les rejets de promesses. Standardiser autour de `middleware/errorHandler.js` existant.
- **Actions :**
  1. Créer un wrapper `asyncHandler(fn)` ou utiliser directement Express 5 async
  2. Supprimer les `console.error` dans les catch (laisser l'error handler centralisé)

---

### [P2-ARCH-006] 🟡 Migrer les uploads vers un CDN/S3
- [ ] **Statut :** À faire
- **Fichiers :** `backend/middleware/multer.js`
- **Problème :** Stockage local non scalable, perte au redéploiement.
- **Actions :**
  1. Intégrer `multer-s3` ou Cloudflare R2
  2. Configurer un CDN devant le bucket
  3. Migrer les fichiers existants de `public/uploads/`

---

### [P2-ARCH-007] 🟡 Traiter les routes commentées
- [ ] **Statut :** À faire
- **Fichiers :** `backend/index.js:51-53` (CRM, support tickets, analytics)
- **Actions :**
  1. Auditer chaque module : utilisable ou non ?
  2. Si oui → activer et tester
  3. Si non → supprimer les fichiers (controller, model, routes)

---

### [P2-ARCH-008] 🟡 Réarchitecturer les tokens JWT
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:323-326`
- **Problème :** Tokens contenant wallet + subscription + plan complets (plusieurs KB), non révocables.
- **Actions :**
  1. Réduire le payload à : `{ _id, role, email, iat, exp, jti }`
  2. Charger wallet/subscription depuis la DB avec cache Redis
  3. Ajouter `jti` (JWT ID unique) pour la révocation
  4. Blacklist Redis pour les tokens révoqués
  5. Réduire l'expiration de 7j à 1h + refresh token 30j

---

## PHASE 3 — PERFORMANCE ET SCALABILITÉ (Semaine 5-6)

### [P3-PERF-001] 🟢 Implémenter la pagination sur tous les endpoints de liste
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auth.controllers.js:466, 791`, `backend/controllers/artwork.controller.js`, `backend/controllers/auction.controller.js`
- **Actions :**
  1. Créer un helper `paginate(Model, query, req)` → `{ data, total, page, totalPages }`
  2. Appliquer `.skip((page-1)*limit).limit(limit)` partout
  3. Export Excel : utiliser le streaming MongoDB cursor

---

### [P3-PERF-002] 🟢 Optimiser le cron job des enchères
- [ ] **Statut :** À faire
- **Fichiers :** `backend/jobs/auctionCronJob.js:43`
- **Problème :** Tourne toutes les minutes même sans enchères actives.
- **Actions :**
  1. Vérification rapide préalable : `const hasActive = await Auction.exists({ status: { $in: ['upcoming', 'ongoing'] } })`
  2. Réduire la fréquence à `*/5 * * * *`
  3. Ajouter des index sur `{ status: 1, startTime: 1 }` et `{ status: 1, endTime: 1 }` dans le modèle `Auction`

---

### [P3-PERF-003] 🟢 Implémenter les WebSockets pour les enchères en temps réel
- [ ] **Statut :** À faire
- **Fichiers :** `backend/index.js:61`, controllers auction et bid
- **Actions :**
  1. Intégrer `socket.io` avec le serveur HTTP existant (`this.server`)
  2. Créer des rooms par `auctionId`
  3. Émettre `bid:new` lors de chaque enchère valide
  4. Émettre `auction:ended` depuis le cron job
  5. Mettre à jour le frontend pour s'abonner en temps réel

---

### [P3-PERF-004] 🟢 Corriger la race condition sur les enchères
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/bid.controller.js:32-49`
- **Problème :** Vérification du prix + mise à jour sans transaction MongoDB. Deux enchères simultanées peuvent corrompre l'état.
- **Actions :**
  1. Utiliser les transactions MongoDB (`session.withTransaction`)
  2. `Auction.findOneAndUpdate({ _id: auctionId, currentPrice: { $lt: amount } }, ...)` — atomique
  3. Si document non trouvé → 409 Conflict
  4. Ajouter un incrément minimum (champ `minBidIncrement` dans le modèle Auction)

---

### [P3-PERF-005] 🟢 Corriger la durée de subscription hardcodée
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/payment.controller.js:252`
- **Problème :** `Date.now() + 30 * 24 * 60 * 60 * 1000` en dur, ignore la durée réelle du plan.
- **Actions :**
  1. Ajouter `durationDays` dans le modèle `Plan`
  2. Calculer `endDate` depuis `plan.durationDays`
  3. Implémenter le renouvellement automatique

---

### [P3-PERF-006] 🟢 Optimiser les requêtes MongoDB (lean + indexes)
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/auction.controller.js:96-115`
- **Actions :**
  1. Ajouter `.lean()` sur toutes les requêtes de liste en lecture seule (gain x5-10)
  2. Remplacer les `.populate()` multiples par des aggregations `$lookup` quand possible
  3. Vérifier la présence des indexes sur les `ref` fields

---

### [P3-PERF-007] 🟢 Corriger la lecture statique du token dans useAPI.js
- [ ] **Statut :** À faire
- **Fichiers :** `frontend/src/api/useAPI.js:11`
- **Problème :** Token lu à l'initialisation du module → `null` si l'utilisateur se connecte après le chargement.
- **Action :** Lire `localStorage.getItem("token")` dynamiquement à chaque appel API via un getter.

---

## PHASE 4 — UX/UI ET LOGIQUE MÉTIER (Semaine 7)

### [P4-UX-001] 🔵 Supprimer le blocage du clic-droit et F12
- [ ] **Statut :** À faire
- **Fichiers :** `frontend/src/App.jsx:13-50`
- **Problème :** Bloque les utilisateurs légitimes, casse l'accessibilité, hostile à l'UX. N'empêche pas la copie.
- **Action :** Supprimer les handlers `handleContextMenu` et `handleKeyDown`. Protéger les images avec des watermarks et URLs signées côté serveur.

---

### [P4-META-001] 🔵 Implémenter un minimum bid increment
- [ ] **Statut :** À faire
- **Fichiers :** `backend/controllers/bid.controller.js:32-34`, modèle `Auction`
- **Problème :** Un centime suffit pour surenchérir → spam et bruit inutile.
- **Actions :**
  1. Ajouter `minBidIncrement` dans le modèle `Auction` (défaut : 5% du prix actuel)
  2. Valider `amount >= auction.currentPrice + auction.minBidIncrement`
  3. Afficher l'incrément minimum dans l'UI

---

### [P4-META-002] 🔵 Standardiser la gestion des erreurs frontend
- [ ] **Statut :** À faire
- **Fichiers :** `frontend/src/api/*.js`
- **Problème :** Mix de patterns : `{ error }`, exceptions, `null`.
- **Actions :**
  1. Définir un type uniforme : `{ data?, error?, status }`
  2. Créer un hook `useApiCall<T>` avec loading/error/data
  3. Centraliser les messages d'erreur dans des constantes

---

## PHASE 5 — TESTS ET QUALITÉ CODE (Semaine 8-9)

### [P5-TEST-001] ⚪ Mettre en place un framework de tests
- [ ] **Statut :** À faire
- **Fichiers :** `backend/package.json:18` — `"test": "echo \"Error: no test specified\""`, dossier `backend/tests/`
- **Actions :**
  1. Installer `jest` + `supertest` pour les tests d'intégration API
  2. Configurer `jest` avec couverture de code (`--coverage`)
  3. **Priorités de tests :**
     - Tests sécurité : endpoints bypass retournent 404 en production
     - Tests payment : flux complet achat/abonnement
     - Tests race condition : simuler deux enchères simultanées
     - Tests auth : accès non autorisé → 401/403
  4. Objectif minimum : **60% de couverture** sur `auth`, `payment`, `bid`

---

### [P5-TEST-002] ⚪ Mettre en place un pipeline CI/CD avec checks de sécurité
- [ ] **Statut :** À faire
- **Actions :**
  1. Créer `.github/workflows/ci.yml`
  2. Checks obligatoires à chaque PR :
     - `npm test`
     - `npm audit`
     - `eslint` avec `eslint-plugin-security`
     - Detection de secrets : `gitleaks` pour prévenir les futurs leaks
  3. Bloquer le merge si un check échoue

---

### [P5-QUAL-001] ⚪ Introduire TypeScript progressivement
- [ ] **Statut :** À faire
- **Plan d'adoption :**
  1. Commencer par les modèles Mongoose (`models/*.ts`) — ROI le plus élevé
  2. Typer les controllers par ordre de criticité : `auth`, `payment`, `bid`
  3. Configurer `tsconfig.json` avec `strict: true`

---

### [P5-QUAL-002] ⚪ Standardiser la configuration des logs
- [ ] **Statut :** À faire
- **Actions :**
  1. Installer `winston` avec transports Console (dev) + File (prod) + Sentry (déjà installé)
  2. Format JSON structuré en production
  3. Ajouter un `X-Request-ID` traçable dans tous les logs
  4. Supprimer les 200+ `console.log` identifiés dans le code

---

## SCORECARD — ÉTAT ACTUEL vs CIBLE

| Domaine | Score Actuel | Score Cible | Principales actions |
|---|:---:|:---:|---|
| **Sécurité — Secrets** | 0/10 | 9/10 | P0-SEC-001 |
| **Sécurité — Auth/Authz** | 1/10 | 8/10 | P0-SEC-002, P0-SEC-003, P1-SEC-008, P1-SEC-009 |
| **Sécurité — Données** | 0/10 | 8/10 | P0-SEC-004, P0-SEC-005 |
| **Sécurité — Infrastructure** | 2/10 | 8/10 | P0-SEC-006, P1-SEC-007 |
| **Logique Métier** | 3/10 | 8/10 | P3-PERF-004, P1-SEC-015, P3-PERF-005, P4-META-001 |
| **Performance** | 4/10 | 7/10 | P3-PERF-001, P3-PERF-002, P3-PERF-006, P3-PERF-007 |
| **Scalabilité** | 3/10 | 8/10 | P3-PERF-003, P2-ARCH-006, P2-ARCH-004 |
| **Architecture** | 3/10 | 8/10 | P2-ARCH-001 à P2-ARCH-008 |
| **UX/UI** | 4/10 | 9/10 | P0-UX-001, P0-UX-002, P4-UX-001 |
| **Tests / Qualité** | 0/10 | 7/10 | P5-TEST-001, P5-TEST-002, P5-QUAL-001 |
| **Conformité RGPD** | 1/10 | 7/10 | P1-SEC-016 |
| **Score Global** | **2.1/10** | **7.9/10** | |

---

## SYNTHÈSE TIMELINE

```
SEMAINE 0 — IMMÉDIAT (BLOQUANT)
├── [P0-SEC-001] Rotation de tous les secrets compromis
├── [P0-SEC-002] Supprimer endpoints bypass + corriger useAuth.js
├── [P0-SEC-003] Supprimer le JWT Logidoo hardcodé
├── [P0-SEC-004] Chiffrer les clés privées ETH
├── [P0-SEC-005] Supprimer les données bancaires du modèle User
├── [P0-SEC-006] Corriger la configuration CORS
├── [P0-UX-001]  Supprimer window.close() sur resize
└── [P0-UX-002]  Supprimer log mot de passe en clair

SEMAINE 1-2 — CRITIQUE
├── [P1-SEC-007] Installer Helmet.js
├── [P1-SEC-008] Bloquer l'escalade de privilège (updateUser)
├── [P1-SEC-009] Protéger getUserById / getUserByEmail
├── [P1-SEC-010] Remplacer console.log par logger structuré
├── [P1-SEC-011] Protéger /api/report-error
├── [P1-SEC-012] Vraie validation MIME sur les uploads
├── [P1-SEC-013] Activer la vérification email
├── [P1-SEC-014] Sécuriser deleteAllUsers
├── [P1-SEC-015] Idempotence sur les callbacks PayDunya
└── [P1-SEC-016] Conformité RGPD pour le tracking

SEMAINE 3-4 — HAUTE
├── [P2-ARCH-001] Refactoriser le middleware auth (5 → 1 fonction)
├── [P2-ARCH-002] Supprimer dépendances serveur du frontend
├── [P2-ARCH-003] Isoler le code de développement
├── [P2-ARCH-004] Activer Redis (cache + blacklist JWT)
├── [P2-ARCH-005] Standardiser gestion erreurs async
├── [P2-ARCH-007] Traiter les routes commentées
└── [P2-ARCH-008] Réarchitecturer les tokens JWT

SEMAINE 5-6 — MOYENNE
├── [P3-PERF-001] Pagination sur tous les endpoints de liste
├── [P3-PERF-002] Optimiser le cron job enchères
├── [P3-PERF-003] WebSockets pour les enchères
├── [P3-PERF-004] Transactions MongoDB sur les enchères (race condition)
├── [P3-PERF-005] Corriger la durée de subscription
├── [P3-PERF-006] .lean() + indexes sur les requêtes MongoDB
├── [P3-PERF-007] Token dynamique dans useAPI.js
└── [P2-ARCH-006] Migration uploads vers CDN/S3

SEMAINE 7 — NORMALE
├── [P4-UX-001]   Supprimer le blocage clic-droit / F12
├── [P4-META-001] Minimum bid increment
└── [P4-META-002] Standardiser les erreurs frontend

SEMAINE 8-9 — DETTE TECHNIQUE
├── [P5-TEST-001] Framework de tests (Jest + Supertest)
├── [P5-TEST-002] Pipeline CI/CD avec checks de sécurité
├── [P5-QUAL-001] Introduction TypeScript
└── [P5-QUAL-002] Logs structurés (Winston)
```

---

## ESTIMATION DE L'EFFORT

| Phase | Effort estimé | Profil recommandé |
|---|:---:|---|
| Phase 0 (Urgences) | 2-3 jours | Senior Backend |
| Phase 1 (Sécurité) | 5-7 jours | Senior Backend + Security |
| Phase 2 (Architecture) | 8-10 jours | Senior Fullstack |
| Phase 3 (Performance) | 7-9 jours | Senior Backend |
| Phase 4 (UX/Métier) | 3-4 jours | Fullstack |
| Phase 5 (Tests/Qualité) | 8-10 jours | Senior + QA |
| **TOTAL** | **33-43 jours** | |

---

*Document généré le 19 février 2026 — À mettre à jour au fil des corrections*
