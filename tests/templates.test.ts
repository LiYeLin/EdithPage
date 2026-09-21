import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templates, DEFAULT_TEMPLATE_ID } from '../src/templates/registry.ts'
import { DEFAULT_TEMPLATE_APPEARANCE, canSwitchTemplate, getIconPositionPersistence, getTemplateAppearance, isNavigationConfig, normalizeIconPositionPersistence, normalizeIconPositions, normalizeTemplateConfig, resetContent, selectTemplate } from '../src/templates/config.ts'
import { defaultConfig } from '../src/data/defaultConfig.ts'

const catalog = [...templates, { ...templates[0], id: 'list' }]
test('production catalog has unique IDs and keeps bubble as the default', () => {
  assert.equal(new Set(templates.map(t => t.id)).size, templates.length)
  assert.deepEqual(templates.map(t => t.id), [DEFAULT_TEMPLATE_ID, 'matter', 'beijing', 'plain'])
  assert.equal(templates[0].name, '液态气泡')
  assert.equal(templates[1].name, '物理图标')
  assert.equal(templates[2].name, '北京地标')
  assert.equal(templates[3].name, '纯净应用网格')
  for (const template of templates) {
    assert.equal(typeof template.appearance?.backgroundImage, 'string')
    assert.ok(template.appearance?.backgroundImage.length > 0)
  }
})
for (const id of [undefined, 'unknown', 'bubble', 'matter', 'beijing', 'plain', 'list']) {
  test(`config compatibility changes only templateId: ${id}`, () => {
    const config = { ...defaultConfig, templateId: id, accent: 'orange' as const }
    const result = normalizeTemplateConfig(config, catalog)
    assert.equal(result.templateId, id === 'list' || id === 'matter' || id === 'plain' || id === 'beijing' ? id : 'bubble')
    assert.equal(result.modules, config.modules)
    assert.equal(result.accent, config.accent)
  })
}
test('Beijing uses its local temple photo without changing other template backgrounds', () => {
  assert.deepEqual(getTemplateAppearance(templates.find(template => template.id === 'beijing')), {
    backgroundImage: '/terrain/temple-of-heaven.jpg',
    backgroundPosition: 'center',
  })
  for (const template of templates.filter(template => template.id !== 'beijing')) {
    assert.deepEqual(getTemplateAppearance(template), DEFAULT_TEMPLATE_APPEARANCE)
  }
})

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


test('位置快照规范化只保留有限范围内的相对坐标和有限角度', () => {
  assert.deepEqual(normalizeIconPositions(null), {})
  assert.deepEqual(normalizeIconPositions([]), {})
  assert.deepEqual(normalizeIconPositions('invalid'), {})
  assert.deepEqual(normalizeIconPositions({
    valid: { x: 0, y: 1, angle: -Math.PI },
    negativeX: { x: -0.01, y: 0.5, angle: 0 },
    largeY: { x: 0.5, y: 1.01, angle: 0 },
    infiniteAngle: { x: 0.5, y: 0.5, angle: Infinity },
    missingField: { x: 0.5, y: 0.5 },
    arrayValue: [],
  }), {
    valid: { x: 0, y: 1, angle: -Math.PI },
  })
})

test('位置持久化兼容部分模板配置和非法槽位', () => {
  assert.deepEqual(normalizeIconPositionPersistence({
    matter: { enabled: true, positions: { alpha: { x: 0.2, y: 0.3, angle: 0.4 } } },
    beijing: null,
  }), {
    matter: { enabled: true, positions: { alpha: { x: 0.2, y: 0.3, angle: 0.4 } } },
    beijing: { enabled: false, positions: {} },
  })
  assert.deepEqual(normalizeIconPositionPersistence({
    matter: { enabled: 'yes', positions: [] },
    beijing: { enabled: false, positions: { bad: { x: 2, y: 0, angle: 0 } } },
  }), {
    matter: { enabled: false, positions: {} },
    beijing: { enabled: false, positions: {} },
  })
  assert.deepEqual(normalizeIconPositionPersistence({ beijing: { positions: { alpha: { x: 0.5, y: 0.5, angle: 1 } } } }), {
    beijing: { enabled: false, positions: { alpha: { x: 0.5, y: 0.5, angle: 1 } } },
  })
  assert.deepEqual(normalizeIconPositionPersistence(undefined), {})
})

test('已规范化读取仍会再次过滤被外部修改的非法位置', () => {
  const position = { x: 0.5, y: 0.5, angle: 0 }
  const config = { iconPositionPersistence: {
    matter: { enabled: true, positions: { alpha: position, stale: { x: Number.NaN, y: 0.5, angle: 0 } } },
  } }
  assert.deepEqual(getIconPositionPersistence(config, 'matter'), { enabled: true, positions: { alpha: position } })
  assert.deepEqual(getIconPositionPersistence(config, 'beijing'), { enabled: false, positions: {} })
})

test('导航配置校验拒绝缺少模板 ID、非字符串模板 ID和错误位置字段', () => {
  assert.equal(isNavigationConfig({ ...defaultConfig, templateId: undefined }), false)
  assert.equal(isNavigationConfig({ ...defaultConfig, templateId: 123 }), false)
  assert.equal(isNavigationConfig({ ...defaultConfig, iconPositionPersistence: { matter: { enabled: true, positions: { bad: { x: 4, y: 0, angle: 0 } } } } }), true)
})
