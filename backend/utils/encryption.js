/**
 * Utilitaire de chiffrement AES-256-GCM pour les données sensibles.
 *
 * Variable d'environnement requise :
 *   WALLET_ENCRYPTION_KEY — clé hexadécimale de 32 octets (64 caractères hex)
 *   Générer avec : openssl rand -hex 32
 *
 * Format du texte chiffré : iv:authTag:ciphertext (tout en hex, séparé par ':')
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 96 bits recommandé pour GCM
const TAG_LENGTH = 16;     // 128 bits (défaut)

function getKey() {
    const hex = process.env.WALLET_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            'WALLET_ENCRYPTION_KEY manquante ou invalide. ' +
            'Générer avec : openssl rand -hex 32'
        );
    }
    return Buffer.from(hex, 'hex');
}

/**
 * Chiffre une chaîne en clair.
 * @param {string} plaintext
 * @returns {string} format "iv:authTag:ciphertext" en hexadécimal
 */
function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Déchiffre une chaîne chiffrée par encrypt().
 * @param {string} ciphertext format "iv:authTag:data" en hexadécimal
 * @returns {string} texte en clair
 */
function decrypt(ciphertext) {
    const key = getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Format de ciphertext invalide');
    }
    const [ivHex, authTagHex, dataHex] = parts;
    const iv      = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data    = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Indique si une valeur est déjà au format chiffré.
 */
function isEncrypted(value) {
    return typeof value === 'string' && value.split(':').length === 3;
}

module.exports = { encrypt, decrypt, isEncrypted };
