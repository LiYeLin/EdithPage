import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templates, DEFAULT_TEMPLATE_ID } from '../src/templates/registry.ts'
import { DEFAULT_TEMPLATE_APPEARANCE, getTemplateAppearance, normalizeTemplateConfig, resetContent, selectTemplate, canSwitchTemplate } from '../src/templates/config.ts'
import { defaultConfig } from '../src/data/defaultConfig.ts'

const catalog = [...templates, { ...templates[0], id: 'list' }]
test('production catalog has unique IDs and keeps bubble as the default', () => {
  assert.equal(new Set(templates.map(t => t.id)).size, templates.length)
  assert.deepEqual(templates.map(t => t.id), [DEFAULT_TEMPLATE_ID, 'matter', 'plain'])
  assert.equal(templates[0].name, '液态气泡')
  assert.equal(templates[1].name, '物理图标')
  assert.equal(templates[2].name, '纯净应用网格')
  for (const template of templates) {
    assert.equal(typeof template.appearance?.backgroundImage, 'string')
    assert.ok(template.appearance?.backgroundImage.length > 0)
  }
})
for (const id of [undefined, 'unknown', 'bubble', 'matter', 'plain', 'list']) {
  test(`config compatibility changes only templateId: ${id}`, () => {
    const config = { ...defaultConfig, templateId: id, accent: 'orange' as const }
    const result = normalizeTemplateConfig(config, catalog)
    assert.equal(result.templateId, id === 'list' || id === 'matter' || id === 'plain' ? id : 'bubble')
    assert.equal(result.modules, config.modules)
    assert.equal(result.accent, config.accent)
  })
}
test('missing template appearance falls back to the global background', () => {
  assert.deepEqual(getTemplateAppearance(undefined), DEFAULT_TEMPLATE_APPEARANCE)
  assert.deepEqual(getTemplateAppearance({ appearance: { backgroundImage: '/custom.jpg' } }), {
    ...DEFAULT_TEMPLATE_APPEARANCE,
    backgroundImage: '/custom.jpg',
  })
})

test('switch retains content; reset retains active template, never mutates defaults', () => {
  const config = { ...defaultConfig, modules: [], accent: 'orange' as const }
  const next = selectTemplate(config, 'list')
  assert.equal(next.modules, config.modules)
  assert.equal(next.accent, config.accent)
  assert.equal(selectTemplate(next, 'list'), next)
  const reset = resetContent(next)
  assert.equal(reset.templateId, 'list')
  assert.deepEqual(reset.modules, defaultConfig.modules)
  assert.equal(reset.accent, defaultConfig.accent)
  assert.equal(defaultConfig.templateId, 'bubble')
})
for (const dragging of [false, true]) for (const settling of [false, true]) {
  test(`switch guard: dragging=${dragging} settling=${settling}`, () => {
    assert.equal(canSwitchTemplate({ dragging, settling }), !dragging && !settling)
  })
}
