// P1-SEC-012 — Validation MIME par magic bytes (non spoofable)
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Signatures magic bytes des types autorisés
const MAGIC_SIGNATURES = [
  // JPEG : FF D8 FF
  { mime: 'image/jpeg', ext: 'jpg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  // PNG  : 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png',  ext: 'png', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // GIF  : 47 49 46 38
  { mime: 'image/gif',  ext: 'gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP : RIFF....WEBP (octets 0-3 = RIFF, octets 8-11 = WEBP)
  { mime: 'image/webp', ext: 'webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * Détecte le vrai type MIME d'un buffer par ses magic bytes.
 * @param {Buffer} buffer
 * @returns {{ mime: string, ext: string } | null}
 */
function detectMagicType(buffer) {
  for (const sig of MAGIC_SIGNATURES) {
    const slice = buffer.slice(sig.offset, sig.offset + sig.bytes.length);
    if (sig.bytes.every((b, i) => slice[i] === b)) {
      // Cas WebP : vaut la peine de vérifier les octets 8-11 = "WEBP"
      if (sig.mime === 'image/webp') {
        const webpMarker = buffer.slice(8, 12);
        if (Buffer.from('WEBP').equals(webpMarker)) return sig;
        continue;
      }
      return sig;
    }
  }
  return null;
}

// Stockage en mémoire pour pouvoir inspecter le buffer AVANT d'écrire sur disque
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo
  fileFilter: (_req, file, cb) => {
    // Pré-filtre léger sur le mimetype déclaré (la vraie vérif se fait en post via magic bytes)
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Type de fichier non autorisé.'), false);
    }
    cb(null, true);
  },
});

/**
 * Middleware express : multer (mémoire) → vérification magic bytes → écriture disque sécurisée.
 * Le nom du fichier est un UUID v4 (aucun caractère du originalname n'est utilisé).
 */
const multerMiddleware = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Erreur upload : ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return next();
    }

    // Vérification des magic bytes réels
    const detected = detectMagicType(req.file.buffer);
    if (!detected) {
      return res.status(400).json({ message: 'Fichier rejeté : type réel non autorisé (magic bytes invalides).' });
    }

    // Écriture sur disque avec nom UUID (anti path-traversal, anti collision)
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const uploadDir = path.resolve(`public/uploads/${year}/${month}`);
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${randomUUID()}.${detected.ext}`;
    const filepath = path.join(uploadDir, filename);

    try {
      fs.writeFileSync(filepath, req.file.buffer);
    } catch (writeErr) {
      console.error('Erreur écriture fichier upload:', writeErr);
      return res.status(500).json({ message: 'Erreur serveur lors du traitement du fichier.' });
    }

    // Mise à jour des métadonnées pour les controllers en aval
    req.file.filename    = filename;
    req.file.path        = filepath;
    req.file.destination = uploadDir;
    req.file.mimetype    = detected.mime;

    next();
  });
};

module.exports = multerMiddleware;
