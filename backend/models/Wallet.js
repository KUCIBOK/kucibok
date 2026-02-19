const mongoose = require('mongoose');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const walletSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    address: {
        type: String,
        required: true,
        unique: true,
    },
    // Stockée chiffrée en AES-256-GCM — ne jamais exposer via API
    privateKey: {
        type: String,
        select: false,   // exclue par défaut de toutes les requêtes
    },
    balance: {
        type: Number,
        default: 0,
    },
    currency: {
        type: String,
        default: 'ETH',
    },
    transactions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    }],
}, {
    timestamps: true,
});

// Chiffrer la privateKey avant chaque sauvegarde
walletSchema.pre('save', function (next) {
    if (this.isModified('privateKey') && this.privateKey && !isEncrypted(this.privateKey)) {
        try {
            this.privateKey = encrypt(this.privateKey);
        } catch (err) {
            return next(err);
        }
    }
    next();
});

/**
 * Retourne la clé privée déchiffrée.
 * Usage réservé aux opérations blockchain internes — ne jamais exposer via API.
 */
walletSchema.methods.getDecryptedPrivateKey = function () {
    if (!this.privateKey) return null;
    return decrypt(this.privateKey);
};

module.exports = mongoose.model('Wallet', walletSchema);
