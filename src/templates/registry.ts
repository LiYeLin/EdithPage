import type { TemplateDefinition } from './types'

export const DEFAULT_TEMPLATE_ID = 'bubble'
export const templates: readonly TemplateDefinition[] = [
  {
    id: DEFAULT_TEMPLATE_ID,
    name: '液态气泡',
    description: '分类以漂浮气泡排列，支持分页和跨分类拖动站点。',
    editingHint: '点击图标编辑，拖动到其他分类，点击 × 删除，点击空白处完成',
    appearance: { backgroundImage: '/edith-landscape.jpg', backgroundPosition: 'center 46%' },
    load: () => import('./bubble/BubbleTemplate'),
  },
  {
    id: 'matter',
    name: '物理图标',
    description: '网站图标以随机矩形和多边形掉落、碰撞并堆叠。',
    editingHint: '拖动图标到任意位置，点击图标打开站点，编辑模式下可修改或删除',
    appearance: { backgroundImage: '/edith-landscape.jpg', backgroundPosition: 'center 46%' },
    load: () => import('./matter/MatterTemplate'),
  },
  {
    id: 'beijing',
    name: '北京地标',
    description: '图标落在天坛、故宫和中国尊的建筑线稿上，碰撞并堆叠。',
    editingHint: '拖动图标探索建筑地形，点击打开站点，编辑模式下可修改或删除',
    appearance: { backgroundImage: '/terrain/temple-of-heaven.jpg', backgroundPosition: 'center' },
    load: () => import('./beijing/BeijingTemplate'),
  },
  {
    id: 'plain',
    name: '纯净应用网格',
    description: '以简洁的应用图标网格展示当前分类。',
    editingHint: '使用模板内的编辑入口管理分类和站点，点击空白处完成',
    appearance: { backgroundImage: '/edith-landscape.jpg', backgroundPosition: 'center 46%' },
    load: () => import('./plain/PlainTemplate'),
  },
]
