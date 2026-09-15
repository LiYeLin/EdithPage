import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/App'
import { templates } from '../../src/templates/registry'
import type { TemplateDefinition } from '../../src/templates/types'
import '../../src/styles.css'

const query = new URLSearchParams(location.search)
let attempts = 0
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const testTemplates: readonly TemplateDefinition[] = [
  ...templates,
  {
    id: 'list', name: '普通列表测试', description: '独立布局，只使用公共数据与业务操作。', editingHint: '列表编辑提示：使用列表按钮管理内容。',
    appearance: { backgroundImage: '/fixture-list-background.jpg', backgroundPosition: 'center 20%' },
    load: async () => {
      attempts++
      await delay(Number(query.get('delay') ?? 0))
      if (query.has('fail') && attempts === 1) throw new Error('Fixture load failure')
      if (query.has('fail-always') && sessionStorage.getItem('template-fixture-ready') !== '1') throw new Error('Fixture initial failure')
      return import('./ListTemplate')
    },
  },
]

createRoot(document.getElementById('root')!).render(<StrictMode><App templates={testTemplates} /></StrictMode>)
