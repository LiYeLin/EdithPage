/** Reference tuning; homepage overrides the palette while retaining the physics. */
export const liquidMaterial = {
  blur: 15,
  contrast: 32,
  fill: 'rgba(104, 128, 255, 0.76)',
  filterPadding: 70,
  waviness: 1.7,
  wavinessFreq: 0.013,
  shadow: '0 18px 30px -14px rgba(62, 83, 193, 0.32), inset 0 2px 3px rgba(255, 255, 255, 0.65), inset 0 -8px 16px rgba(34, 53, 166, 0.23)',
} as const

/** Neutral translucent glass for bridges; never introduce the demo's blue paint. */
export const navigationLiquidMaterial = {
  ...liquidMaterial,
  // Alpha participates in Liquid's blur/threshold geometry. Keep the demo alpha
  // so thin necks survive; apply translucency to the rendered SVG instead.
  fill: 'rgba(231, 246, 239, 0.76)',
  shadow: '0 18px 30px -14px rgba(0, 0, 0, 0.32), inset 0 2px 3px rgba(255, 255, 255, 0.4), inset 0 -8px 16px rgba(7, 17, 13, 0.23)',
} as const
