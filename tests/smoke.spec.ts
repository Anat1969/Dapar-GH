import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bank from '../src/data/bank.json' with { type: 'json' }

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

const VOCAB = (bank as { id: string; skill: string; correct_index: number; options: unknown[] }[]).find((q) => q.skill === 'אוצר מילים')!

interface Captured { method: string; url: string; body: string | null }

/** מוקים לכל קריאות Supabase. */
async function mockSupabase(page: Page, opts: { google?: boolean; admin?: boolean } = {}) {
  const calls: Captured[] = []
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  await page.route(/supabase\.co/, async (route) => {
    const req = route.request()
    const url = req.url()
    calls.push({ method: req.method(), url, body: req.postData() })
    if (url.includes('/auth/v1/settings')) return route.fulfill({ json: { external: { google: Boolean(opts.google) } } })
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: fakeUser })
    if (url.includes('/rpc/dapar_is_admin')) return route.fulfill({ json: Boolean(opts.admin) })
    if (url.includes('/rest/v1/')) {
      if (req.method() === 'GET') return route.fulfill({ json: [] })
      return route.fulfill({ status: 201, json: [] })
    }
    return route.fulfill({ json: {} })
  })
  return calls
}

const fakeUser = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' }

function fakeJwt() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: fakeUser.id, email: fakeUser.email, role: 'authenticated', exp: 4102444800 })}.sig`
}

async function enterLocal(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'כניסה עם Google' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך במכשיר הזה' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test('כניסה: Google כבוי מציג הודעה, ואפשר להמשיך במכשיר', async ({ page }) => {
  await mockSupabase(page, { google: false })
  await page.goto('/')
  await expect(page.getByText('הכניסה עם Google עדיין לא הופעלה בפרויקט')).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await shot(page, '01-login')
  await page.getByRole('button', { name: 'המשך במכשיר הזה' }).click()
  await expect(page.getByText('מגדלי השליטה')).toBeVisible()
  await shot(page, '02-today')
})

test('סרגל עליון: כפתור הלוגו A&I, העתקת קישור, שיחת הפיתוח, שם האפליקציה לדף הבית', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // AI_MENU_JS: a local copy of the shared A&I menu, for runs where appofapp-gh.vercel.app is unreachable.
  if (process.env.AI_MENU_JS) await page.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ path: process.env.AI_MENU_JS, contentType: 'application/javascript' }))
  await mockSupabase(page)
  await enterLocal(page)
  await page.goto('/practice?domain=verbal')
  await expect(page.locator('header >> text=העתקת קישור')).toHaveCount(0)
  await page.locator('ai-menu .logo').click()
  const menu = page.locator('ai-menu')
  await menu.getByRole('menuitem', { name: 'העתקת קישור' }).click()
  await expect(menu.getByText('הקישור הועתק')).toBeVisible()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('/practice?domain=verbal')
  await expect(page.locator('ai-menu .panel')).toBeHidden()
  await page.locator('ai-menu .logo').click()
  await expect(menu.getByRole('menuitem', { name: 'שיחת הפיתוח' })).toHaveAttribute('href', /claude\.ai\/code\/session_/)
  await expect(menu.getByRole('menuitem', { name: 'פרויקט המחקר' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'יציאה' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: /דפ"ר עילאי/ }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('כל לשוניות הניווט נטענות בלי שגיאות', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('net::') && !m.text().includes('Failed to load resource') && errors.push(m.text()))
  await mockSupabase(page)
  await enterLocal(page)
  for (const [name, heading] of [['תרגול', 'בחרו תחום'], ['תיקון טעויות', 'תיקון טעויות'], ['מבחן מדומה', 'בחרו מבחן'], ['לוח מדידה', 'איפה עומדים'], ['היום', null]] as const) {
    await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name, exact: true }).click()
    if (heading) await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'ניהול הבנק' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('תרגול: תשובה מציגה הסבר וסיווג טעות, יישום נעול', async ({ page }) => {
  await mockSupabase(page)
  await enterLocal(page)
  await page.goto('/practice?domain=verbal')
  await expect(page.getByText(/נפתחת אחרי 10 שאלות הבנה/)).toBeVisible()
  await shot(page, '03-layers')
  await page.getByRole('link', { name: /^ידע/ }).click()
  await expect(page.locator('.qcard')).toBeVisible()
  await expect(page.getByText('חדש בסגנון').first()).toBeVisible()
  await shot(page, '04-question')
  await page.locator('.option').first().click()
  await expect(page.locator('.explanation')).toBeVisible()
  const wrong = await page.locator('.verdict-wrong').count()
  if (wrong) await expect(page.getByText('מה קרה בטעות הזו?')).toBeVisible()
  await shot(page, '05-feedback')
  await page.getByRole('button', { name: 'לשאלה הבאה' }).click()
  await expect(page.locator('.option:not([disabled])').first()).toBeVisible()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dapar.local.v1') || '{}'))
  expect(stored.items.length).toBe(1)
  await page.goto('/practice?domain=verbal&layer=application')
  await expect(page.getByText(/שכבת יישום עוד נעולה/)).toBeVisible()
})

test('טעות שחוזרת שלוש פעמים: עצירה וניסוח במילים שלו', async ({ page }) => {
  await mockSupabase(page)
  await page.addInitScript((qid) => {
    if (localStorage.getItem('dapar.seeded')) return
    localStorage.setItem('dapar.seeded', '1')
    localStorage.setItem('dapar.mode', '"local"')
    const items = [1, 2].map((k) => ({ id: `seed-${k}`, attempt_id: 'seed', question_id: qid, selected_index: 3, is_correct: false, seconds_taken: 5, error_type: 'knowledge', answered_at: `2026-10-19T10:0${k}:00.000Z` }))
    localStorage.setItem('dapar.local.v1', JSON.stringify({ attempts: [{ id: 'seed', kind: 'practice', started_at: '2026-10-19T10:00:00.000Z', finished_at: '2026-10-19T10:10:00.000Z', score_estimate: null }], items, notes: [] }))
  }, VOCAB.id)
  await page.goto('/repair')
  await expect(page.getByText('אוצר מילים')).toBeVisible()
  await shot(page, '06-repair')
  await page.getByRole('button', { name: 'התחלת תיקון' }).click()
  const wrongIdx = VOCAB.correct_index === 0 ? 1 : 0
  await page.locator('.option').nth(wrongIdx).click()
  await page.getByRole('button', { name: 'לשאלה הבאה' }).click()
  await expect(page.getByRole('dialog', { name: 'עוצרים רגע' })).toBeVisible()
  await shot(page, '07-restate')
  // הדיאלוג נפתח מתחת לסרגל העליון
  const barBottom = await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().bottom)
  const dlgTop = await page.locator('.dialog-layer').evaluate((el) => el.getBoundingClientRect().top)
  expect(dlgTop).toBeGreaterThanOrEqual(barBottom - 1)
  await page.getByRole('dialog').locator('textarea').fill('אני ממש לחוץ, אבל כשלא בטוחים מציבים במשפט')
  await page.getByRole('button', { name: 'שמירת הניסוח' }).click()
  await expect(page.getByText('זה תרגול')).toBeVisible()
  await page.getByRole('button', { name: 'הבנתי' }).click()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dapar.local.v1') || '{}'))
  expect(stored.notes.length).toBe(1)
  expect(JSON.stringify(stored)).not.toContain('mood')
})

test('מבחן מדומה חלקי: טיימר, תשובה, דוח עם כיתוב מדד פנימי', async ({ page }) => {
  await mockSupabase(page)
  await enterLocal(page)
  await page.goto('/mock?kind=partial&domain=verbal')
  await page.getByRole('button', { name: 'התחלת המבחן' }).click()
  await page.getByRole('button', { name: 'התחלת הפרק' }).click()
  await expect(page.locator('.timer-text')).toBeVisible()
  await page.locator('.option').first().click()
  await expect(page.locator('.option-chosen')).toHaveCount(1)
  await shot(page, '08-mock')
  await page.reload()
  await expect(page.locator('.option-chosen')).toHaveCount(1)
  await page.getByRole('button', { name: 'סיום הפרק עכשיו' }).click()
  await expect(page.getByRole('heading', { name: 'דוח מבחן' })).toBeVisible()
  await expect(page.getByText('מדד פנימי, לא ציון רשמי').first()).toBeVisible()
  await expect(page.getByText('זמן').first()).toBeVisible()
  await shot(page, '09-report')
  await page.getByRole('link', { name: 'ללוח המדידה' }).click()
  await expect(page.getByText('מדד פנימי, לא ציון רשמי').first()).toBeVisible()
  await shot(page, '10-stats')
})

test('סשן יומי: שלושה חלקים עם טיימר, בלי ציון', async ({ page }) => {
  await mockSupabase(page)
  await enterLocal(page)
  await page.goto('/session')
  await page.getByRole('button', { name: 'התחלת היום' }).click()
  await expect(page.locator('.seg')).toHaveCount(3)
  await page.getByRole('button', { name: /סיום החלק/ }).click()
  await expect(page.locator('.qcard')).toBeVisible()
  await shot(page, '11-session')
  await page.getByRole('button', { name: /סיום החלק/ }).click()
  await page.getByRole('button', { name: 'סיום היום' }).click()
  await expect(page.getByRole('heading', { name: 'סיכום היום' })).toBeVisible()
  await expect(page.getByText('הצעד הבא')).toBeVisible()
  await expect(page.getByText('ציון משוער')).toHaveCount(0)
})

test('אדמין: שאלה בלי source לא נשמרת, שאלה תקינה נשלחת ל-Supabase', async ({ page }) => {
  const calls = await mockSupabase(page, { google: true, admin: true })
  await page.addInitScript(([token, user]) => {
    localStorage.setItem('sb-ktqmwpbzcnzkhjskqisy-auth-token', JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user }))
  }, [fakeJwt(), fakeUser] as const)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'ניהול בנק השאלות' })).toBeVisible()
  await shot(page, '12-admin')
  await page.getByRole('button', { name: 'שאלה חדשה' }).click()
  const dlg = page.getByRole('dialog', { name: 'שאלה חדשה' })
  await dlg.getByLabel('נושא').fill('בדיקה')
  await dlg.getByLabel('שאלה', { exact: true }).fill('שאלת בדיקה')
  for (let i = 1; i <= 4; i++) await dlg.getByLabel(`אפשרות ${i}`, { exact: true }).fill(`תשובה ${i}`)
  await dlg.getByLabel('הסבר').fill('הסבר בדיקה')
  await dlg.getByRole('button', { name: 'שמירה' }).click()
  await expect(dlg.getByText('חובה לבחור מקור')).toBeVisible()
  expect(calls.filter((c) => c.method === 'POST' && c.url.includes('dapar_questions'))).toHaveLength(0)
  await dlg.getByLabel('מקור (source)').selectOption('new')
  await dlg.getByRole('button', { name: 'שמירה' }).click()
  await expect(page.getByText('השאלה נשמרה')).toBeVisible()
  const post = calls.find((c) => c.method === 'POST' && c.url.includes('dapar_questions'))
  expect(post?.body).toContain('"source":"new"')
})

test('נייד 380: בלי גלילה אופקית בכל הדפים', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 })
  await mockSupabase(page)
  await enterLocal(page)
  for (const path of ['/', '/practice', '/practice?domain=quant', '/practice?domain=figural&layer=knowledge', '/repair', '/mock', '/mock?kind=full', '/stats', '/session']) {
    await page.goto(path)
    await page.waitForTimeout(400)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(over, path).toBeLessThanOrEqual(0)
    await expect(page.locator('.topbar')).toBeVisible()
  }
  await page.goto('/')
  await shot(page, '13-mobile-today')
  await page.goto('/practice?domain=figural&layer=knowledge')
  await shot(page, '14-mobile-figural')
})

test('PWA: אין שגיאות התקנה', async ({ baseURL }) => {
  // פרופיל קבוע, כי בגלישה פרטית Chrome לא מאפשר התקנה
  const dir = mkdtempSync(join(tmpdir(), 'pwa-'))
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.CI ? undefined : '/opt/pw-browsers/chromium' })
  const page = await ctx.newPage()
  await mockSupabase(page)
  await page.goto(baseURL + '/')
  await page.waitForTimeout(2500)
  const cdp = await ctx.newCDPSession(page)
  const res = await cdp.send('Page.getInstallabilityErrors')
  expect(res.installabilityErrors).toEqual([])
  const manifest = await (await page.request.get(baseURL + '/manifest.webmanifest')).json()
  expect(manifest.dir).toBe('rtl')
  expect(manifest.lang).toBe('he')
  expect(manifest.display).toBe('standalone')
  await ctx.close()
})
