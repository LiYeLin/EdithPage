import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Liquid } from 'liquid-gooey'
import { navigationLiquidMaterial } from '../src/effects/liquidMaterial.ts'

test('navigation drop and neck survive the actual Liquid alpha threshold', () => {
  const svg = renderToStaticMarkup(createElement(Liquid, navigationLiquidMaterial))
  const matrix = svg.match(/<feColorMatrix[^>]+values="([^"]+)"[^>]+result="goo"/)
  assert.ok(matrix, 'Read the installed renderer rather than duplicate its threshold formula')
  const values = matrix[1].trim().split(/\s+/).map(Number)
  const alpha = Number(navigationLiquidMaterial.fill.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1)
  // A blurred edge has less alpha than its center. Preserve a neck at 60% coverage,
  // not just a solid center; otherwise the drag icon survives but its bridge vanishes.
  for (const coverage of [1, .6]) {
    assert.ok(alpha * coverage * values[18] + values[19] > 0,
      `Liquid erases the drag silhouette at coverage ${coverage} with fill ${navigationLiquidMaterial.fill}`)
  }
})
