import { expect, test } from '@playwright/test'
import { defaultConfig } from '../../src/data/defaultConfig'

const configKey = 'edith-navigation-config-v3'
const points = [
  ['中心', 0, 0], ['左缘', -.4, 0], ['右缘', .4, 0], ['上缘', 0, -.4], ['下缘', 0, .4],
] as const

for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  for (const variant of ['module', 'frequent']) {
    for (const input of ['mouse', 'touch']) {
      test(`${width}×${height} ${variant} ${input}: 删除红叉中心和四边均有效`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN', hasTouch: true })
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
        await context.route('https://**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
        await page.addInitScript(({ key, config }) => {
          localStorage.setItem(key, JSON.stringify(config))
          localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
        }, { key: configKey, config: defaultConfig })
        try {
          for (const [point, dx, dy] of points) {
            await page.goto('/')
            await expect(page).toHaveTitle('Edith 新标签页')
            await expect(page.locator('.bubble-workspace')).toHaveAttribute('data-capacity', 'fits')
            const tile = page.locator(`.site-tile-wrap[data-site-id="chatgpt"][data-variant="${variant}"]`)
            const link = tile.locator('a')
            // Use a real long press; allow the initial entrance animation to finish first.
            await expect(link).toBeVisible()
            await page.waitForTimeout(650)
            const bounds = (await link.boundingBox())!
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            await page.mouse.down()
            await page.waitForTimeout(550)
            await page.mouse.up()
            await expect(page.locator('.app')).toHaveClass(/is-editing/)
            const button = tile.getByRole('button', { name: '删除 ChatGPT', exact: true })
            await expect(button).toBeVisible()
            await page.waitForTimeout(250)
            const before = (await button.boundingBox())!
            const x = before.x + before.width * (.5 + dx)
            const y = before.y + before.height * (.5 + dy)
            if (input === 'mouse') {
              await page.mouse.move(x, y)
              await page.mouse.down()
              // A realistic press used to move the red cross away before mouseup.
              await page.waitForTimeout(90)
              const during = (await button.boundingBox())!
              await page.mouse.up()
              expect(Math.hypot(during.x - before.x, during.y - before.y), point).toBeLessThan(3)
            } else {
              await page.touchscreen.tap(x, y)
            }
            await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).modules
              .flatMap((module: { sites: { id: string }[] }) => module.sites).map((site: { id: string }) => site.id), configKey), point)
              .toEqual(defaultConfig.modules.flatMap(module => module.sites).filter(site => site.id !== 'chatgpt').map(site => site.id))
            await expect(page.locator('.site-tile-wrap[data-site-id="chatgpt"]')).toHaveCount(0)
            await expect(page.locator('.app')).toHaveClass(/is-editing/)
            await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
            await expect(page.getByRole('dialog')).toHaveCount(0)
            await expect(page.locator('vite-error-overlay')).toHaveCount(0)
            expect(context.pages()).toHaveLength(1)
          }
          expect(errors).toEqual([])
        } finally {
          await context.close()
        }
      })
    }
  }
}
