# 🔔 Admin Notifications System

Admin (kucibok221@gmail.com) reçoit des notifications pour tous les événements importants de la plateforme.

---

## ✅ Notifications Implémentées

### 1️⃣ **Nouvelle inscription** (`POST /api/auth/signup`)
- **Fichier**: `api/[...path].js` ligne ~700
- **Infos envoyées**: Email, Nom, Rôle, Pays, Institution
- **Statut**: ✅ FAIT

### 2️⃣ **Nouvelle œuvre** (`POST /api/artworks`)
- **Fichier**: `api/[...path].js` ligne ~421
- **Infos envoyées**: Titre, Artiste, Catégorie, Prix
- **Statut**: ✅ FAIT

### 3️⃣ **Trial Subscription créé** (`POST /api/subscriptions/create-trial`)
- **Fichier**: `api/[...path].js` ligne ~1078
- **Infos envoyées**: Utilisateur, Rôle, Date fin essai
- **Statut**: ✅ FAIT

---

## 🔧 Notifications À Ajouter

### 4️⃣ **Nouvel Sourcing Inquiry** 
- **Route**: `POST /api/sourcing/inquiry` (À CRÉER)
- **Fonction**: Demande de partenariat B2B
- **Infos à envoyer**:
  - Nom entreprise
  - Type (Gallery, Institution, Collector, etc.)
  - Email contact
  - Message/Besoin
- **Filtre**: Artiste, Curator, Advisor UNIQUEMENT
- **Priorité**: 🔴 HAUTE

### 5️⃣ **Nouvelle Demande de Livraison**
- **Route**: `POST /api/delivery/request` (À VÉRIFIER/CRÉER)
- **Fonction**: Booking logistique transfrontalière
- **Infos à envoyer**:
  - Utilisateur
  - Œuvre(s) à livrer
  - Destination (Pays)
  - Type de livraison (Express, Standard)
  - Coût estimé
- **Priorité**: 🔴 HAUTE

### 6️⃣ **Nouvelle Transaction/Paiement**
- **Route**: Webhook PayDunya `POST /api/payments/paydunya-webhook` (À AJOUTER)
- **Fonction**: Quand un paiement est reçu
- **Infos à envoyer**:
  - Montant
  - Type (Achat, Abonnement, etc.)
  - Client
  - Statut (Success, Pending, Failed)
- **Priorité**: 🔴 HAUTE

### 7️⃣ **Certificat KCB Généré**
- **Route**: `POST /api/certificates/generate` (À VÉRIFIER/CRÉER)
- **Fonction**: Certification d'une œuvre
- **Infos à envoyer**:
  - Numéro KCB
  - Titre œuvre
  - Artiste
  - Date génération
- **Priorité**: 🟡 MOYENNE

### 8️⃣ **Nouveau Commentaire/Review**
- **Route**: `POST /api/artworks/:id/comments` (À CRÉER)
- **Fonction**: Commentaires sur les œuvres
- **Infos à envoyer**:
  - Auteur
  - Œuvre concernée
  - Texte (premiers 100 caractères)
  - Note (si applicable)
- **Priorité**: 🟢 BASSE

### 9️⃣ **Rapport d'Erreur**
- **Route**: `POST /api/report-error` (À VÉRIFIER)
- **Fonction**: Quand un utilisateur signale un bug
- **Infos à envoyer**:
  - Type d'erreur
  - Message d'erreur
  - Page/Fonction
  - Utilisateur
  - Navigateur/Device
- **Priorité**: 🟡 MOYENNE

---

## 📋 Checklist d'Implémentation

### Routes à créer/vérifier:
- [ ] `POST /api/sourcing/inquiry` — Créer endpoint + notification
- [ ] `POST /api/delivery/request` — Vérifier si existe, ajouter notification
- [ ] `POST /api/payments/paydunya-webhook` — Créer/améliorer webhook
- [ ] `POST /api/certificates/generate` — Vérifier si existe, ajouter notification
- [ ] `POST /api/artworks/:id/comments` — Créer endpoint + notification
- [ ] `POST /api/report-error` — Vérifier si existe, ajouter notification

### Code à ajouter:
Chaque route doit appeler `sendAdminNotification()` avec:
- `subject`: Titre de la notification (ex: "Nouveau sourcing inquiry")
- `message`: Texte descriptif
- `details`: Objet avec clés/valeurs à afficher

**Exemple**:
```javascript
await sendAdminNotification(
  'Nouveau sourcing inquiry',
  'Une nouvelle demande de partenariat a été reçue.',
  {
    'Entreprise': req.body.company_name,
    'Type': req.body.type,
    'Email': req.body.email,
    'Date': new Date().toLocaleString('fr-FR'),
  }
)
```

---

## 🎯 Filtre : Artiste, Curator, Advisor UNIQUEMENT

⚠️ **Important** : Les notifications sont envoyées pour les actions des utilisateurs avec les rôles :
- ✅ `artist`
- ✅ `curator`
- ✅ `advisor`

**PAS** de notifications pour :
- ❌ `buyer` (sauf si c'est une transaction importante)
- ❌ `gallery`

Avant d'envoyer une notification, vérifier :
```javascript
if (!['artist', 'curator', 'advisor'].includes(user.role)) {
  return // Skip notification
}
```

---

## 📧 Template d'Email

Toutes les notifications utilisent le template `sendAdminNotification()` qui génère:
```
[KUCIBOK ADMIN] [Titre]

[Message]

[Table des détails]

---
Notification automatique — Ne pas répondre à cet email
```

---

## 🔗 Ressources

- **Fonction d'envoi**: `sendAdminNotification()` dans `api/[...path].js`
- **Email admin**: `kucibok221@gmail.com`
- **Service d'email**: Resend (https://resend.com)
- **Clé API**: Configurée dans Vercel env `RESEND_API_KEY`

---

## ⏱️ Prochaines Étapes

1. ✅ Commit Option 1 (Signup, Artworks, Trials)
2. 🔄 Implémenter routes prioritaires (Sourcing, Delivery, Payments)
3. 📋 Ajouter routes secondaires (Certificates, Comments, Errors)
4. 🧪 Tester chaque notification
5. 📊 Ajouter logging des notifications envoyées (optional)

---

**Last updated**: 2026-08-30  
**Status**: In Progress  
**Owner**: Kucibok Dev Team
