import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Écrit en production : toutes les données créées portent le marqueur [TEST E2E].
// À supprimer ensuite depuis le dashboard ou dans Supabase.
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'test.png')
const CRASH_TEXT = 'Erreur interne du serveur'
const TAG = `[TEST E2E ${new Date().toISOString().slice(0, 16)}]`

const ROLES = {
  artist: { email: process.env.E2E_ARTIST_EMAIL, password: process.env.E2E_ARTIST_PASSWORD, home: '/dashboard/artist' },
  curator: { email: process.env.E2E_CURATOR_EMAIL, password: process.env.E2E_CURATOR_PASSWORD, home: '/dashboard/curator' },
  advisor: { email: process.env.E2E_ADVISOR_EMAIL, password: process.env.E2E_ADVISOR_PASSWORD, home: '/dashboard/advisor' },
}

async function login(page, { email, password, home }) {
  await page.goto('/sign-in')
  await page.getByPlaceholder('Votre email').fill(email)
  await page.getByPlaceholder('Votre mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page.waitForURL(new RegExp(home.replace(/\//g, '\\/')), { timeout: 30_000 })
  // La bannière de consentement recouvre la page et bloque les clics : on la ferme (« Refuser »)
  await page.getByRole('button', { name: 'Refuser', exact: true }).click({ timeout: 5_000 }).catch(() => {})
}

// Ouvre la page Profil par le menu (groupe « Compte »)
async function openProfil(page) {
  const profilItem = page.locator('nav').getByText(/^Profil$/).first()
  if (!(await profilItem.isVisible())) {
    await page.locator('nav').getByText(/^Compte$/).first().click()
  }
  await profilItem.click()
  await page.waitForLoadState('networkidle')
}

// Champ « Nom complet » du profil : libellé associé ou attribut name
function nameField(page) {
  return page.locator('label:has-text("Nom complet") + input, input[name="name"]').first()
}

// Ouvre chaque entrée du menu latéral et vérifie qu'aucun écran ne plante.
async function crawlMenu(page) {
  const entries = page.locator('nav a[href], nav button')
  const count = await entries.count()
  expect(count, 'le menu doit contenir des entrées').toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const entry = page.locator('nav a[href], nav button').nth(i)
    if (!(await entry.isVisible())) continue
    const label = (await entry.innerText()).trim()
    await entry.click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(CRASH_TEXT), `écran « ${label} »`).toHaveCount(0)
  }
}

// ─── Tous les rôles : chargement et menu ────────────────────────────────────
for (const [role, account] of Object.entries(ROLES)) {
  test.describe(`Dashboard ${role} — menu`, () => {
    test.skip(!account.email || !account.password, `identifiants ${role} non fournis`)
    test.beforeEach(async ({ page }) => login(page, account))

    test('le dashboard se charge sans erreur', async ({ page }) => {
      await expect(page.getByText(CRASH_TEXT)).toHaveCount(0)
      await expect(page.locator('aside').first()).toBeVisible()
    })

    test('chaque entrée du menu s\'ouvre sans erreur', async ({ page }) => {
      await crawlMenu(page)
    })
  })
}

// ─── Artiste : ajout, modification, profil ──────────────────────────────────
test.describe('Dashboard artiste — œuvres et profil', () => {
  const artist = ROLES.artist
  test.skip(!artist.email || !artist.password, 'identifiants artiste non fournis')
  test.beforeEach(async ({ page }) => login(page, artist))

  test('ajout d\'une œuvre : assistant en 4 étapes', async ({ page }) => {
    // Ouvre le groupe « Mes Œuvres & Ventes » puis le lien d'ajout ; à défaut, la page directe
    await page.getByRole('button', { name: /œuvres/i }).first().click().catch(() => {})
    await page.getByRole('link', { name: /ajouter|soumettre|nouvelle/i }).first().click().catch(() => page.goto('/dashboard/artist/submit-artwork'))
    // Étape 1 : détails (titre + description, obligatoires)
    await page.getByPlaceholder('Titre de l\'oeuvre').fill(`${TAG} œuvre`)
    // Catégorie (liste déroulante obligatoire) : première option non vide
    await page.locator('select#category').selectOption({ index: 1 })
    // Description (éditeur riche) : saisie au clavier pour que l'éditeur la prenne en compte
    await page.locator('.ql-editor').first().click()
    await page.keyboard.type('Description de test automatisé.')
    await page.getByRole('button', { name: 'Suivant', exact: true }).click()
    // Diagnostic : si l'étape 2 n'apparaît pas, on liste les champs que le navigateur juge invalides
    await page.waitForTimeout(2_000)
    if (!(await page.locator('input[type="file"]').count())) {
      const invalid = await page.evaluate(() =>
        Array.from(document.querySelectorAll(':invalid')).map(
          (el) => `${el.tagName} id="${el.id}" name="${el.name}" placeholder="${el.placeholder || ''}" message="${el.validationMessage}"`
        )
      )
      throw new Error(`Étape 1 bloquée. Champs invalides :\n${invalid.join('\n') || '(aucun champ marqué invalide)'}`)
    }
    // Étape 2 : photo
    await page.locator('input[type="file"]').setInputFiles(FIXTURE)
    await page.getByRole('button', { name: 'Suivant', exact: true }).click()
    // Étape 3 : prix
    await page.getByPlaceholder('Entrez le prix de l\'oeuvre').fill('1000')
    await page.getByRole('button', { name: 'Suivant', exact: true }).click()
    // Étape 4 : soumission
    await page.getByRole('button', { name: 'Soumettre', exact: true }).click()
    await expect(page.getByText(/soumis|succès|enregistr|en attente/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('l\'œuvre de test apparaît dans « Mes œuvres »', async ({ page }) => {
    await page.locator('aside').getByText(/œuvres/i).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(TAG).first()).toBeVisible({ timeout: 30_000 })
  })

  test('modification du titre d\'une œuvre de test', async ({ page }) => {
    await page.locator('aside').getByText(/œuvres/i).first().click()
    await page.waitForLoadState('networkidle')
    const card = page.getByText(TAG).first()
    await card.click()
    await page.getByRole('button', { name: /modifier/i }).first().click()
    const title = page.getByPlaceholder('Titre de l\'œuvre').or(page.getByPlaceholder('Titre de l\'oeuvre'))
    await title.fill(`${TAG} modifiée`)
    await page.getByRole('button', { name: /enregistrer|sauvegarder|mettre à jour/i }).first().click()
    await expect(page.getByText(/modifiée|mise à jour|enregistr/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('modification du nom du profil, puis restauration', async ({ page }) => {
    // Diagnostic : on note les appels serveur et les erreurs console pendant la sauvegarde
    const trace = []
    page.on('response', async (r) => {
      if (r.request().method() !== 'GET' && r.url().includes('/api/')) {
        const body = await r.text().catch(() => '')
        trace.push(`${r.request().method()} ${r.url()} -> ${r.status()} ${body.slice(0, 300)}`)
      }
    })
    page.on('console', (m) => {
      if (m.type() === 'error' && !/analytics|doubleclick|Content Security Policy|contentscript/i.test(m.text())) {
        trace.push(`console: ${m.text().slice(0, 300)}`)
      }
    })

    await openProfil(page)
    const nameInput = nameField(page)
    const original = await nameInput.inputValue()
    await nameInput.fill(`${original} ${TAG}`.trim())
    await page.getByRole('button', { name: /enregistrer|sauvegarder|save/i }).first().click()
    await page.waitForTimeout(4000)

    if (await page.getByText(/Erreur lors de la sauvegarde/i).count()) {
      throw new Error(`Sauvegarde en erreur. Appels pendant la sauvegarde :\n${trace.join('\n') || '(aucun appel serveur)'}`)
    }

    // Le rechargement ramène à l'accueil du dashboard : on revient au profil par le menu
    await openProfil(page)
    await expect(nameField(page)).toHaveValue(new RegExp(TAG.replace(/[[\]]/g, '\\$&')))
    // Restauration du nom d'origine
    await nameField(page).fill(original)
    await page.getByRole('button', { name: /enregistrer|sauvegarder|save/i }).first().click()
  })
})
