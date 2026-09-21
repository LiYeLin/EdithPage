import { expect, test, type Page } from '@playwright/test'

type Template = 'matter' | 'beijing'
const configKey = 'edith-navigation-config-v3'
const runtimeErrors = new WeakMap<Page, string[]>()
const saved = { x: 0.25, y: 0.3, angle: 0.4 }
const config = (templateId: Template, enabled = false) => ({
  templateId, accent: 'mint', modules: [{ id: 'a', title: '分类 A', description: '', accent: '#9ff7cd', sites: [
    { id: 'alpha', name: 'Alpha', url: 'https://position-target.test/alpha', description: '' },
  ] }, { id: 'b', title: '分类 B', description: '', accent: '#b9b6ff', sites: [] }],
  ...(enabled ? { iconPositionPersistence: { [templateId]: { enabled: true, positions: { alpha: saved } } } } : {}),
})
const icon = (page: Page, template: Template) => page.locator(`.${template}-stage [data-site-id="alpha"]`)
async function position(page: Page, template: Template) {
  return icon(page, template).evaluate((element, id) => {
    const el = element as HTMLElement
    const stage = el.closest(`.${id}-stage`) as HTMLElement
    const matrix = new DOMMatrix(el.style.transform)
    // Transform origin is the center; matrix translation is the unrotated top-left.
    return { x: (matrix.m41 + el.offsetWidth / 2) / stage.clientWidth,
      y: (matrix.m42 + el.offsetHeight / 2) / stage.clientHeight,
      angle: parseFloat(el.style.getPropertyValue(`--${id}-angle`)) }
  }, template)
}
async function stored(page: Page, template: Template) {
  return page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).iconPositionPersistence?.[id], { key: configKey, id: template })
}
async function ready(page: Page, template: Template) {
  await expect(page.locator(`.${template}-canvas`)).toHaveCount(1)
  await expect(icon(page, template)).toHaveCSS('transform', /matrix/)
}
async function start(page: Page, template: Template, enabled = false) {
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-09-18T12:00:01Z'))
  await page.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, { key: configKey, initial: config(template, enabled) })
  await page.goto('/')
  await ready(page, template)
  await expect(page).toHaveURL('http://127.0.0.1:4179/')
  await expect(page).toHaveTitle(/Edith/)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}
async function expectPosition(page: Page, template: Template, expected: typeof saved, tolerance = 0.002) {
  const actual = await position(page, template)
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance)
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance)
  expect(Math.abs(actual.angle - expected.angle)).toBeLessThan(tolerance)
}
async function openSettings(page: Page) {
  await page.getByRole('button', { name: '打开设置' }).click()
  await page.clock.runFor(400)
  await expect(page.getByRole('switch', { name: '保存图标位置' })).toBeVisible()
}

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', route => {
    if (route.request().url().startsWith('http://127.0.0.1:4179/')) return route.continue()
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#88bfa5"/></svg>' })
    return route.fulfill({ contentType: 'text/plain', body: '' })
  })
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
})

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([])
})

for (const template of ['matter', 'beijing'] as const) {
  test(`${template}: legacy default-off refresh starts above the stage again`, async ({ page }) => {
    await start(page, template)
    expect((await position(page, template)).y).toBeLessThan(0)
    await page.clock.runFor(4000)
    expect((await position(page, template)).y).toBeGreaterThan(0.4)
    expect(await stored(page, template)).toBeUndefined()
    await page.reload()
    await ready(page, template)
    expect((await position(page, template)).y).toBeLessThan(0)
    await openSettings(page)
    await expect(page.getByRole('switch', { name: '保存图标位置' })).toHaveAttribute('aria-checked', 'false')
  })

  test(`${template}: drag, pagehide, refresh and resize preserve normalized position and angle`, async ({ page }) => {
    await start(page, template, true)
    await expectPosition(page, template, saved)
    const box = (await icon(page, template).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2 + 60, { steps: 8 })
    await page.mouse.up()
    const dropped = await position(page, template)
    expect(dropped.x).toBeGreaterThan(saved.x + 0.05)
    const snapshot = await stored(page, template)
    expect(snapshot.enabled).toBe(true)
    expect(snapshot.positions.alpha.x).toBeCloseTo(dropped.x, 4)
    await page.reload() // Real pagehide must save before the document disappears.
    await ready(page, template)
    await expectPosition(page, template, dropped)
    // Force real layout notifications without advancing the physical clock.
    await page.setViewportSize({ width: 1000, height: 800 })
    await expect.poll(async () => (await stored(page, template)).positions.alpha.x).toBeCloseTo(dropped.x, 4)
    await expectPosition(page, template, dropped)
    // Advance physics without dragging; pagehide must capture the current, not last-drop position.
    await page.clock.runFor(200)
    const latest = await position(page, template)
    expect(latest.y).toBeGreaterThan(dropped.y)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect((await stored(page, template)).positions.alpha.y).toBeCloseTo(latest.y, 4)
    await page.reload()
    await ready(page, template)
    await expectPosition(page, template, latest)
  })

  test(`${template}: switch persists, disabling retains its snapshot, re-enabling restores it`, async ({ page }) => {
    await start(page, template, true)
    await openSettings(page)
    const toggle = page.getByRole('switch', { name: '保存图标位置' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    const disabled = await stored(page, template)
    expect(disabled.positions.alpha).toEqual(saved)
    await page.reload()
    await ready(page, template)
    expect((await position(page, template)).y).toBeLessThan(0)
    await openSettings(page)
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    // No clock advance: assert restoration before gravity resumes.
    await expectPosition(page, template, saved)
    await page.getByRole('button', { name: /恢复默认内容与配色/ }).click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(await stored(page, template)).toBeUndefined()
  })
}

test('template departure saves live positions; switching back restores independent layouts', async ({ page }) => {
  await start(page, 'beijing', true)
  const other = { x: 0.65, y: 0.25, angle: -0.7 }
  await page.evaluate(({ key, position }) => {
    const value = JSON.parse(localStorage.getItem(key)!)
    value.iconPositionPersistence.matter = { enabled: true, positions: { alpha: position } }
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: configKey, position: other })
  await page.reload()
  await ready(page, 'beijing')
  await page.clock.runFor(200)
  const beijingPosition = await position(page, 'beijing')
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').filter({ hasText: '物理图标' }).click()
  await ready(page, 'matter')
  await expectPosition(page, 'matter', other)
  expect((await stored(page, 'beijing')).positions.alpha.y).toBeCloseTo(beijingPosition.y, 4)
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').filter({ hasText: '北京地标' }).click()
  await ready(page, 'beijing')
  await expectPosition(page, 'beijing', beijingPosition)
  expect((await stored(page, 'matter')).positions.alpha).toEqual(other)
  await expect(page.locator('.beijing-stage')).toHaveAttribute('data-paused', 'false')
})

test('Beijing enabled: rename/move/add/delete preserve ID-based positions and prune snapshots', async ({ page }) => {
  await start(page, 'beijing', true)
  const canvas = await page.locator('.beijing-canvas').elementHandle()
  await page.getByRole('button', { name: '进入编辑模式', exact: true }).click()
  await icon(page, 'beijing').getByRole('button', { name: '编辑 Alpha', exact: true }).click()
  await page.clock.runFor(400)
  const before = await position(page, 'beijing')
  await page.getByPlaceholder('站点名称').fill('重命名 Alpha')
  await page.getByLabel('所属分类').selectOption('b')
  await page.getByRole('button', { name: '保存站点', exact: true }).click()
  await expect(icon(page, 'beijing').locator('.beijing-icon-name')).toHaveText('重命名 Alpha')
  await expectPosition(page, 'beijing', before)
  expect(await canvas!.evaluate(el => el === document.querySelector('.beijing-canvas'))).toBe(true)
  await openSettings(page)
  await page.getByPlaceholder('站点名称').fill('新站点')
  await page.getByPlaceholder('https://example.com').fill('https://position-target.test/new')
  await page.getByRole('button', { name: /添加到「/ }).click()
  const added = page.locator('.beijing-stage [data-site-id]:not([data-site-id="alpha"])')
  await expect(added).toHaveCount(1)
  expect(await added.evaluate(el => new DOMMatrix((el as HTMLElement).style.transform).m42)).toBeLessThan(0)
  await expectPosition(page, 'beijing', before)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await icon(page, 'beijing').getByRole('button', { name: '删除 重命名 Alpha', exact: true }).click()
  await expect(icon(page, 'beijing')).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  expect(Object.keys((await stored(page, 'beijing')).positions)).toEqual([await added.getAttribute('data-site-id')])
  const storedConfig = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), configKey)
  expect(storedConfig.modules[0].sites.some((site: { id: string }) => site.id === 'alpha')).toBe(false)
})

test('Beijing enabled: a drop inside a landmark saves the corrected roof position and restores safely', async ({ page }) => {
  await start(page, 'beijing', true)
  const roof = (await page.locator('[data-landmark="china-zun"]').boundingBox())!
  const box = (await icon(page, 'beijing').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(roof.x + roof.width / 2, roof.y + roof.height / 2, { steps: 8 })
  await page.mouse.up()
  const corrected = await position(page, 'beijing')
  const droppedBox = (await icon(page, 'beijing').boundingBox())!
  expect(droppedBox.y + droppedBox.height / 2).toBeLessThan(roof.y)
  expect((await stored(page, 'beijing')).positions.alpha.y).toBeCloseTo(corrected.y, 4)
  await page.reload()
  await ready(page, 'beijing')
  await expectPosition(page, 'beijing', corrected)
})
