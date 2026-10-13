import { test, expect } from '@playwright/test'

// Dashboard artiste. Écrit en production : les données créées sont marquées [TEST E2E].
const EMAIL = process.env.E2E_ARTIST_EMAIL
const PASSWORD = process.env.E2E_ARTIST_PASSWORD
const CRASH_TEXT = 'Erreur interne du serveur'

async function login(page) {
  await page.goto('/sign-in')
  await page.getByPlaceholder('Votre email').fill(EMAIL)
  await page.getByPlaceholder('Votre mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page.waitForURL(/\/dashboard\/artist/, { timeout: 30_000 })
}

test.describe('Dashboard artiste', () => {
  test.skip(!EMAIL || !PASSWORD, 'identifiants artiste non fournis (E2E_ARTIST_EMAIL / E2E_ARTIST_PASSWORD)')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('le dashboard se charge sans erreur', async ({ page }) => {
    await expect(page.getByText(CRASH_TEXT)).toHaveCount(0)
    await expect(page.locator('aside').first()).toBeVisible()
  })

  test('chaque entrée du menu latéral s\'ouvre sans erreur', async ({ page }) => {
    const count = await page.locator('aside nav button').count()
    expect(count, 'le menu doit contenir des entrées').toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const entry = page.locator('aside nav button').nth(i)
      const label = (await entry.innerText()).trim()
      await entry.click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(CRASH_TEXT), `écran « ${label} »`).toHaveCount(0)
    }
  })

  // À compléter après la première exécution : les champs exacts du formulaire
  // sont dans les écrans « Mes œuvres » et « Mon profil ».
  test.fixme('création d\'une œuvre [TEST E2E]', async () => {})
  test.fixme('upload d\'une image', async () => {})
  test.fixme('modification du profil [TEST E2E]', async () => {})
  test.fixme('modification d\'une œuvre [TEST E2E]', async () => {})
  test.fixme('suppression de l\'œuvre de test', async () => {})
})
