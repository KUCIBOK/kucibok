import { test, expect } from '@playwright/test'

// Espaces réservés à chaque rôle. Un compte sans identifiants est ignoré (test.skip).
const ACCOUNTS = {
  buyer: { email: process.env.E2E_BUYER_EMAIL, password: process.env.E2E_BUYER_PASSWORD, home: '/account' },
  artist: { email: process.env.E2E_ARTIST_EMAIL, password: process.env.E2E_ARTIST_PASSWORD, home: '/dashboard/artist' },
  curator: { email: process.env.E2E_CURATOR_EMAIL, password: process.env.E2E_CURATOR_PASSWORD, home: '/dashboard/curator' },
  advisor: { email: process.env.E2E_ADVISOR_EMAIL, password: process.env.E2E_ADVISOR_PASSWORD, home: '/dashboard/advisor' },
}

const DASHBOARDS = ['/dashboard/admin', '/dashboard/artist', '/dashboard/curator', '/dashboard/advisor', '/account']

async function login(page, { email, password }) {
  await page.goto('/sign-in')
  await page.getByPlaceholder('Votre email').fill(email)
  await page.getByPlaceholder('Votre mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
}

// ─── P0 : ouverture de la plateforme ────────────────────────────────────────
test.describe('P0 — pages principales', () => {
  for (const path of ['/', '/africa', '/global/catalogue', '/africa/artists', '/africa/blog']) {
    test(`${path} répond sans erreur serveur`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response.status()).toBeLessThan(400)
      await expect(page.locator('main').first()).toBeVisible()
    })
  }
})

// ─── P0 : permissions d'un visiteur anonyme ─────────────────────────────────
test.describe('P0 — permissions anonymes', () => {
  for (const path of DASHBOARDS) {
    test(`${path} renvoie vers la connexion`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in/)
    })
  }
})

// ─── P0 : connexion, chaque rôle arrive sur son espace ──────────────────────
test.describe('P0 — connexion par rôle', () => {
  for (const [role, account] of Object.entries(ACCOUNTS)) {
    test(`${role} arrive sur ${account.home}`, async ({ page }) => {
      test.skip(!account.email || !account.password, `identifiants ${role} non fournis`)
      await login(page, account)
      await expect(page).toHaveURL(new RegExp(account.home.replace(/\//g, '\\/')))
    })
  }
})

// ─── P0 : permissions d'un compte connecté ─────────────────────────────────
test.describe('P0 — un rôle ne voit pas les espaces des autres', () => {
  for (const [role, account] of Object.entries(ACCOUNTS)) {
    test(`${role} ne peut pas ouvrir les espaces interdits`, async ({ page }) => {
      test.skip(!account.email || !account.password, `identifiants ${role} non fournis`)
      await login(page, account)
      for (const path of DASHBOARDS.filter((p) => p !== account.home)) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        expect(new URL(page.url()).pathname, `${role} sur ${path}`).not.toBe(path)
      }
    })
  }
})

// ─── P0 : inscription, validation seulement (aucun compte créé) ─────────────
test('P0 — inscription : le mot de passe trop court est refusé', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByRole('button', { name: 'Inscription avec email' }).click()
  await page.getByPlaceholder('vous@exemple.com').fill('test@test.x')
  await page.getByPlaceholder('8 caractères minimum').fill('short')
  await expect(page.getByRole('button', { name: 'Suivant' })).toBeDisabled()
})
