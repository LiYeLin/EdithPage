# Edith（伊迪斯）导航站

以特效、美感与优雅交互为核心的可配置导航站，使用 React、TypeScript 和 Vite。支持网页运行和浏览器新标签页扩展。

## 当前功能

- Google、Perplexity AI、百度搜索；支持 `⌘K` / `Ctrl+K` 聚焦搜索框。
- 四套可切换模板：液态气泡、物理图标、北京地标、纯净应用网格。
- 分类和站点增删改、跨分类移动、删除/移动后 5 秒撤销、三种主题色。
- 根据站点访问次数生成最多 7 个常用站点，首次使用提供引导。
- 本地保存配置、JSON 备份导入导出；物理图标与北京地标可分别开启位置保存。
- Chrome、Edge、360、QQ 的 Manifest V3 扩展构建。

账号、云同步和职业专用模板尚未实现。气泡使用专用布局与交互逻辑；物理图标和北京地标使用 Matter.js，项目没有自研通用物理引擎。

## 本地开发

建议使用 Node.js 22.18+（CI 使用 Node.js 22），依赖版本以 `package-lock.json` 为准。

```bash
npm ci
npm run dev
```

## 检查与构建

```bash
npm test
npm run lint
npm run build
npm run preview
```

浏览器回归：`npm run test:e2e`，需要本机 Google Chrome。扩展打包：`npm run build:extension`，安装和发布方法见 [扩展说明](extension/README.md)。

## 文档

从 [文档索引](docs/README.md) 开始：

- [功能与使用](docs/USER_GUIDE.md)
- [代码架构](docs/ARCHITECTURE.md)
- [配置、存储与备份](docs/DATA_AND_STORAGE.md)
- [开发、测试与构建](docs/DEVELOPMENT.md)
- [模板接入](docs/TEMPLATE_INTEGRATION.md)

网页配置保存在 `localStorage`；扩展配置保存在 `chrome.storage.local`。网页和扩展不会自动共享数据，可用备份迁移。网页版本保留 Vercel Analytics，并可能请求远程 favicon；扩展构建禁用这两项。

背景与图标随包提供。素材说明见 [站点图标](public/site-icons/README.md) 和 [北京地形](public/terrain/README.md)。
