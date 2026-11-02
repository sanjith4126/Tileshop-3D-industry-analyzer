import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 3 smoke suite (docs/MASTER_PROMPT.md §23.3): every existing main screen loads for a signed-in user,
 * shows the synthetic-data banner and its heading, and logs no unexpected console errors.
 * DEV_SEED_USER_PASSWORD must be the password the API seeded the DEV ONLY users with.
 */
const password = process.env.DEV_SEED_USER_PASSWORD ?? ''
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'dev.administrator@tiletwin.local'

// Known, documented library noise (BASELINE K3): drei <Html> unmounts its React roots during route changes.
const ignored = [/synchronously unmount a root while React was already rendering/]

/** Every screen needs a signed-in user, so the app opens on its sign-in screen. */
async function signIn(page: Page) {
  await page.goto('/')
  const form = page.getByRole('form', { name: 'Sign in' })
  await form.getByLabel('Email').fill(adminEmail)
  await form.getByLabel('Password').fill(password)
  await form.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
}

const screens: { path: string; heading: RegExp }[] = [
  { path: '/', heading: /TileTwin/ },
  { path: '/twin', heading: /3D Digital Twin/ },
  { path: '/inspection', heading: /Remote Site Inspection/ },
  { path: '/monitoring', heading: /Machine Monitoring/ },
  { path: '/monitoring/MACHINE-HP-002', heading: /Hydraulic Press 2/ },
  { path: '/tile-quality', heading: /Tile Quality Inspection/ },
  { path: '/predictive', heading: /Predictive Maintenance/ },
  { path: '/assistant', heading: /AI Assistant/ },
  { path: '/knowledge', heading: /Knowledge Centre/ },
  { path: '/reports', heading: /Reports/ },
  { path: '/admin', heading: /Administration/ },
]

test.describe('smoke: existing screens', () => {
  test.skip(!password, 'DEV_SEED_USER_PASSWORD is not set')

  test('every main screen loads with the synthetic-data banner and no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error' && !ignored.some((r) => r.test(m.text()))) errors.push(`${page.url()}: ${m.text()}`) })
    page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))

    await signIn(page)
    for (const s of screens) {
      await page.goto(s.path)
      await expect(page.getByRole('note').filter({ hasText: 'SYNTHETIC' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('the session survives a reload without any token in browser storage, and sign-out ends it', async ({ page, context }) => {
    await signIn(page)
    await page.reload()
    await expect(page.getByText(adminEmail).first()).toBeVisible()              // restored from the refresh cookie
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toMatch(/eyJ[\w-]+\.[\w-]+\./)                                // no JWT in browser storage
    const cookie = (await context.cookies()).find((c) => c.name === 'tiletwin_refresh')
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/api/v1/auth' })

    await page.getByText(adminEmail).first().click()
    await page.getByRole('menuitem', { name: /Sign out/ }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()          // server revoked the session
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('unknown address shows the not-found page', async ({ page }) => {
    await signIn(page)
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to Overview/ })).toBeVisible()
  })
})
