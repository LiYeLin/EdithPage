import type { NavigationConfig, SearchEngine } from '../types'

export const searchEngines: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    homeUrl: 'https://www.google.com/',
    searchUrl: 'https://www.google.com/search?q=',
    domain: 'google.com',
    placeholder: '搜索技术问题、文档或任何灵感…',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    homeUrl: 'https://www.perplexity.ai/',
    searchUrl: 'https://www.perplexity.ai/search?q=',
    domain: 'perplexity.ai',
    placeholder: '向 Perplexity 提问，获得带来源的答案…',
  },
  {
    id: 'baidu',
    name: '百度',
    homeUrl: 'https://www.baidu.com/',
    searchUrl: 'https://www.baidu.com/s?wd=',
    domain: 'baidu.com',
    placeholder: '搜索中文技术内容与资源…',
  },
]

export const defaultConfig: NavigationConfig = {
  accent: 'mint',
  modules: [
    {
      id: 'ai-tools',
      title: 'AI 工具',
      description: '从想法、代码到研究，快速调用你的 AI 搭档',
      accent: '#9ff7cd',
      sites: [
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', description: '通用 AI 助手', shortcut: '⌘1' },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai/', description: '写作与编程助手' },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', description: 'Google AI 助手' },
        { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', description: '推理与代码模型' },
        { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', description: 'AI 搜索与研究' },
        { id: 'cursor', name: 'Cursor', url: 'https://www.cursor.com/', description: 'AI 代码编辑器' },
      ],
    },
    {
      id: 'ai-learning',
      title: 'AI 学习',
      description: '课程、模型和动手实践资源',
      accent: '#b9b6ff',
      sites: [
        { id: 'deeplearning', name: 'DeepLearning.AI', url: 'https://www.deeplearning.ai/', description: '系统化 AI 课程' },
        { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/learn', description: '开源模型与课程' },
        { id: 'fastai', name: 'fast.ai', url: 'https://www.fast.ai/', description: '实践导向深度学习' },
        { id: 'kaggle', name: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', description: '短课与数据竞赛' },
      ],
    },
    {
      id: 'dev-tools',
      title: '开发工具',
      description: '日常开发、部署与问题排查',
      accent: '#ffcb93',
      sites: [
        { id: 'github', name: 'GitHub', url: 'https://github.com/', description: '代码托管与协作', shortcut: '⌘2' },
        { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/', description: '开发问题社区' },
        { id: 'vercel', name: 'Vercel', url: 'https://vercel.com/', description: '前端部署平台' },
        { id: 'docker', name: 'Docker Docs', url: 'https://docs.docker.com/', description: '容器开发文档' },
      ],
    },
    {
      id: 'communities',
      title: '技术社区',
      description: '跟进趋势，交换思路，发现好内容',
      accent: '#88d9ff',
      sites: [
        { id: 'juejin', name: '掘金', url: 'https://juejin.cn/', description: '中文开发者社区' },
        { id: 'v2ex', name: 'V2EX', url: 'https://www.v2ex.com/', description: '创意工作者社区' },
        { id: 'hackernews', name: 'Hacker News', url: 'https://news.ycombinator.com/', description: '全球科技与创业资讯' },
        { id: 'devto', name: 'DEV Community', url: 'https://dev.to/', description: '全球开发者文章' },
      ],
    },
  ],
}
