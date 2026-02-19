/**
 * MIGRATION : Suppression des données bancaires en clair (P0-SEC-005)
 *
 * Ce script supprime le champ `card` (cardNumber, cardName, cvc, expiry)
 * de tous les documents de la collection `users`.
 * Stockage de données PAN en clair = violation PCI-DSS.
 *
 * Usage : node backend/scripts/migrate-remove-card-data.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { config } = require('../config/environnement');

async function run() {
    console.log('Connexion à MongoDB...');
    await mongoose.connect(config.database.uri);
    console.log('Connecté.');

    const result = await mongoose.connection.collection('users').updateMany(
        { card: { $exists: true } },
        { $unset: { card: '' } }
    );

    console.log(`Migration terminée : ${result.modifiedCount} document(s) mis à jour.`);
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Erreur migration :', err);
    process.exit(1);
});
