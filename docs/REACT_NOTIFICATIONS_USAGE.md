# 🔔 React Notification Hooks — Usage Guide

Guide complet pour utiliser les hooks React pour les notifications admin.

---

## 📦 Import

```javascript
import {
  useSourcingInquiry,
  useDeliveryRequest,
  useCertificate,
  useArtworkComment,
  useErrorReporter,
} from '@/api/useNotifications'
```

---

## 🔗 Hooks Disponibles

### 1️⃣ **useSourcingInquiry()** — Demandes B2B

Soumettre une demande de partenariat B2B.

**Exemple :**
```jsx
import { useSourcingInquiry } from '@/api/useNotifications'

export function SourcingForm() {
  const { submit, loading, error } = useSourcingInquiry()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await submit(
      'African Art Gallery Paris',           // organization
      'Gallery Partnership',                 // purpose
      500000,                                // budget (XOF)
      'We want to represent African artists' // message
    )
    if (result.error) {
      console.error('Failed:', result.error)
    } else {
      console.log('Success! Admin notified.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields ... */}
      <button disabled={loading}>{loading ? 'Envoi...' : 'Soumettre'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
```

---

### 2️⃣ **useDeliveryRequest()** — Demandes de Livraison

Créer une demande de livraison transfrontalière.

**Exemple :**
```jsx
import { useDeliveryRequest } from '@/api/useNotifications'

export function DeliveryRequestForm() {
  const { submit, loading, error } = useDeliveryRequest()

  const handleSubmit = async () => {
    const result = await submit(
      ['artwork-001', 'artwork-002'],        // artwork_ids
      'France',                              // destination_country
      'express',                             // delivery_type
      'Fragile - Handle with care'           // special_instructions
    )
    if (!result.error) {
      alert('Demande de livraison créée!')
      // Admin notifié automatiquement
    }
  }

  return (
    <button onClick={handleSubmit} disabled={loading}>
      {loading ? 'Création...' : 'Créer demande'}
    </button>
  )
}
```

---

### 3️⃣ **useCertificate()** — Certificats KCB

Générer un certificat de provenance pour une œuvre.

**Exemple :**
```jsx
import { useCertificate } from '@/api/useNotifications'

export function CertificateGenerator() {
  const { generate, loading, error } = useCertificate()

  const handleGenerate = async () => {
    const result = await generate(
      'artwork-001',                   // artwork_id
      'Amadou Tall',                   // artist_name
      'Senegalese Landscape',          // artwork_title
      '120 x 150 cm',                  // dimensions
      'Acrylic on Canvas',             // medium
      2024                             // year
    )
    if (result.success) {
      console.log('Certificate:', result.data.kcb_number)
      // Admin reçoit la notification
    }
  }

  return (
    <button onClick={handleGenerate} disabled={loading}>
      🏆 Générer Certificat
    </button>
  )
}
```

---

### 4️⃣ **useArtworkComment()** — Commentaires/Reviews

Soumettre un commentaire ou une revue sur une œuvre.

**Exemple :**
```jsx
import { useArtworkComment } from '@/api/useNotifications'

export function ArtworkReview({ artworkId }) {
  const { submit, loading, error } = useArtworkComment()

  const handleSubmit = async (text, rating) => {
    const result = await submit(
      artworkId,  // artwork_id
      text,       // review text
      rating      // 1-5 stars
    )
    if (result.success) {
      console.log('Review submitted!')
      // En attente de modération
      // Admin notifié pour modération
    }
  }

  return (
    <form>
      <textarea placeholder="Votre avis..." />
      <select>
        <option value="1">⭐</option>
        <option value="2">⭐⭐</option>
        <option value="3">⭐⭐⭐</option>
        <option value="4">⭐⭐⭐⭐</option>
        <option value="5">⭐⭐⭐⭐⭐</option>
      </select>
      <button type="submit" disabled={loading}>Soumettre</button>
    </form>
  )
}
```

---

### 5️⃣ **useErrorReporter()** — Rapports d'Erreur

Reporter une erreur application à l'admin.

**Exemple :**
```jsx
import { useErrorReporter } from '@/api/useNotifications'

export function ErrorBoundary({ children }) {
  const { report } = useErrorReporter()

  useEffect(() => {
    const handleError = (error) => {
      report(
        error.name,                    // error_type (e.g., "TypeError")
        error.message,                 // error_message
        window.location.href,          // page_url (auto-filled)
        error.stack                    // additional_context
      )
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [report])

  return children
}
```

**Ou usage direct :**
```jsx
const { report, loading } = useErrorReporter()

try {
  // Some code
} catch (error) {
  await report(
    'NetworkError',
    'Failed to fetch artworks',
    undefined, // auto-fills window.location.href
    'Timeout after 10 seconds'
  )
}
```

---

## 📧 Notifications Admin

Chaque hook trigger une **notification email à `kucibok221@gmail.com`** :

| Hook | Événement | Email |
|------|-----------|-------|
| `useSourcingInquiry()` | 🤝 Nouvelle demande partenariat | ✅ Envoyé |
| `useDeliveryRequest()` | 🚚 Nouvelle demande livraison | ✅ Envoyé |
| `useCertificate()` | 🏆 Certificat KCB généré | ✅ Envoyé |
| `useArtworkComment()` | 💬 Commentaire à modérer | ✅ Envoyé |
| `useErrorReporter()` | 🚨 Erreur signalée | ✅ Envoyé |

---

## 🔒 Authentification

### Routes publiques (pas d'auth requise)
- ✅ `useSourcingInquiry()`
- ✅ `useErrorReporter()`

### Routes protégées (auth requise)
- 🔐 `useDeliveryRequest()` — Artiste, Curator, Advisor
- 🔐 `useCertificate()` — Artiste, Curator, Advisor
- 🔐 `useArtworkComment()` — Utilisateur connecté

Les hooks gèrent **automatiquement le token** via `utils.options`.

---

## 🧪 Test

Pour tester les hooks en local :

```bash
# Lancer le dev server
vercel dev

# Dans la console React
import { useSourcingInquiry } from '@/api/useNotifications'
const { submit } = useSourcingInquiry()
await submit('Test Org', 'Test Purpose', 100000, 'Test message')
```

---

## 📝 Checkl ist d'intégration

- [ ] Ajouter `useSourcingInquiry()` au formulaire B2B
- [ ] Ajouter `useDeliveryRequest()` au dashboard logistique
- [ ] Ajouter `useCertificate()` au panel certificats
- [ ] Ajouter `useArtworkComment()` au composant reviews
- [ ] Ajouter `useErrorReporter()` au ErrorBoundary global
- [ ] Tester chaque hook en local
- [ ] Vérifier que les emails admin arrivent

---

## 🐛 Troubleshooting

**"Token missing" error** → L'utilisateur n'est pas authentifié pour une route protégée
- Solution : Vérifier que l'utilisateur est connecté (`useAuth()`)

**"Email not received"** → Vérifier le redéploiement Vercel
- Solution : Attendre 2-3 min, vérifier Vercel Logs

**Hook returns error** → Mauvaises colonnes ou validation échouée
- Solution : Vérifier la structure du payload vs la doc API

---

## 📚 Ressources

- API Reference: `docs/ADMIN_NOTIFICATIONS.md`
- Hook Implementation: `src/api/useNotifications.js`
- Backend Endpoints: `api/[...path].js`

---

**Last Updated**: 2026-08-30  
**Status**: Production Ready ✅
