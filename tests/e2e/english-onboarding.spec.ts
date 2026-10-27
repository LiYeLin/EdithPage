import { test, expect } from '@playwright/test'

const sizes = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]

for (const locale of ['en-US', 'zh-CN']) {
  for (const viewport of sizes) {
    test.describe(`${locale} ${viewport.width}×${viewport.height}`, () => {
      test.use({ locale, viewport })
      test('all four tour cards stay inside the viewport and finish correctly', async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        await page.route('https://www.google.com/s2/**', route => route.abort())
        await page.route('https://cn.cravatar.com/**', route => route.abort())
        await page.route('**/_vercel/**', route => route.fulfill({ body: '' }))
        await page.goto('/')
        const english = locale === 'en-US'
        await expect(page).toHaveTitle(english ? 'Edith — New Tab' : 'Edith 新标签页')
        const tour = page.getByRole('dialog', { name: english ? 'Welcome tour' : '首次访问引导' })
        for (let step = 1; step <= 4; step++) {
          await expect(tour).toBeVisible()
          await expect(tour.locator('.onboarding-kicker')).toContainText(`${step}/4`)
          // Check the settled layout, including the animation's final position.
          await expect.poll(() => tour.locator('.onboarding-card').evaluate(node => {
            const rect = node.getBoundingClientRect()
            return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
          })).toBe(true)
          if (english) {
            await expect(tour).not.toContainText(/\p{Script=Han}/u)
            await expect(tour).not.toContainText('Hover')
          }
          const next = tour.getByRole('button', {
            name: english ? (step === 1 ? 'Get started' : step === 4 ? 'Done' : 'Next')
              : (step === 1 ? '开始使用' : step === 4 ? '完成' : '下一步'),
            exact: true,
          })
          await expect(next).toBeInViewport()
          if (step === 3 && english && viewport.width === 390) {
            await page.screenshot({ path: '/tmp/edith-english-tour-fixed.png' })
          }
          await next.click()
        }
        await expect(tour).toHaveCount(0)
        expect(await page.evaluate(() => localStorage.getItem('edith-navigation-onboarding-completed-v1'))).toBe('1')
        if (english) await expect(page.getByRole('heading', { name: 'AI Tools', exact: true })).toBeVisible()
        expect(errors).toEqual([])
      })
    })
  }
}

test.describe('English reduced motion and export errors', () => {
  test.use({ locale: 'en-US', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  test('keeps the tour static and displays a translated export failure', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('.onboarding-card')
    await expect(card).toBeVisible()
    expect(await card.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await page.getByRole('button', { name: 'Open settings', exact: true }).click()
    await expect(page.getByLabel('Icon service').getByRole('option', { name: 'Cravatar', exact: true })).toHaveCount(1)
    await page.evaluate(() => localStorage.setItem('edith-navigation-usage-v1', 'invalid'))
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(page.locator('.settings-drawer.is-open').getByRole('status')).toHaveText('Your usage history is corrupted and cannot be exported.')
  })
})
