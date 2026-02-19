/**
 * MIGRATION : Chiffrement des clés privées Ethereum en clair (P0-SEC-004)
 *
 * Ce script chiffre toutes les privateKey stockées en clair dans la collection
 * `wallets` en utilisant AES-256-GCM via utils/encryption.js.
 *
 * Prérequis : définir WALLET_ENCRYPTION_KEY dans .env (openssl rand -hex 32)
 *
 * Usage : node backend/scripts/migrate-encrypt-wallet-keys.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { config } = require('../config/environnement');
const { encrypt, isEncrypted } = require('../utils/encryption');

async function run() {
    console.log('Connexion à MongoDB...');
    await mongoose.connect(config.database.uri);
    console.log('Connecté.');

    const collection = mongoose.connection.collection('wallets');

    // Récupérer les wallets avec une privateKey non chiffrée
    const wallets = await collection.find(
        { privateKey: { $exists: true, $ne: null } },
        { projection: { _id: 1, privateKey: 1 } }
    ).toArray();

    let migrated = 0;
    let skipped = 0;

    for (const wallet of wallets) {
        if (!wallet.privateKey || isEncrypted(wallet.privateKey)) {
            skipped++;
            continue;
        }
        const encryptedKey = encrypt(wallet.privateKey);
        await collection.updateOne(
            { _id: wallet._id },
            { $set: { privateKey: encryptedKey } }
        );
        migrated++;
    }

    console.log(`Migration terminée : ${migrated} clé(s) chiffrée(s), ${skipped} déjà chiffrée(s) ou vides.`);
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Erreur migration :', err);
    process.exit(1);
});
