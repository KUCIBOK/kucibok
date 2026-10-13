# Tests E2E (Playwright)

Par défaut, les tests tournent contre **la production** (`https://kucibok.com`) et sont en lecture seule, sauf les tests marqués ci-dessous.

## Lancer les tests

```
yarn e2e
```

Pour cibler un preview :

```
$env:E2E_BASE_URL="https://votre-preview.vercel.app"; yarn e2e
```

## Comptes de test (ne jamais les committer)

Définissez les variables dans votre terminal (PowerShell) avant de lancer les tests :

```
$env:E2E_BUYER_EMAIL="..."; $env:E2E_BUYER_PASSWORD="..."
$env:E2E_ARTIST_EMAIL="..."; $env:E2E_ARTIST_PASSWORD="..."
$env:E2E_CURATOR_EMAIL="..."; $env:E2E_CURATOR_PASSWORD="..."
$env:E2E_ADVISOR_EMAIL="..."; $env:E2E_ADVISOR_PASSWORD="..."
```

Un compte sans identifiants fait ignorer ses tests (`skipped`), sans erreur.

## Ce qui est couvert

- **P0** : pages principales, accès anonymes aux espaces protégés, connexion par rôle, un rôle ne peut pas ouvrir les espaces des autres, validation d'inscription (aucun compte créé).

## Ce qui n'est pas encore couvert

Les tests P1 et P2 (création d'une œuvre, upload d'image, modification du profil, suppression) écrivent en production. Ils seront ajoutés avec des données marquées `[TEST E2E]`, à supprimer après chaque exécution.
