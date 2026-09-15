# 模板接入说明

模板是搜索区以下内容的完整入口，公共层负责数据、编辑表单、访问统计、持久化和撤销。新增模板不需要修改顶部、搜索或站点业务逻辑。

## 公共协议

在 `src/templates/types.ts` 实现 `NavigationTemplateProps`。模板只读 `modules` 与 `frequentSites`，使用 `actions` 执行编辑、访问和跨分类移动。`revealSite` 是一次性展示请求；模板可以自行定位、分页或滚动。

`onInteractionStateChange` 只报告 `{ dragging, settling }`：输入拖拽期间设 `dragging: true`，释放后如果视觉仍未完成则设 `settling: true`，收尾或取消时恢复两个 `false`。不要上报逐帧位置，也不要把模板私有坐标写入配置。公共层会在这两种状态下拒绝模板切换。

模板还可以在注册信息中声明 `appearance`，由 App 全局壳层应用到整页背景：`backgroundImage` 使用本地 `public` 资源路径，`backgroundPosition` 可选。背景不属于 `NavigationTemplateProps`，也不应在模板组件内部重复渲染；未声明时使用 `/edith-landscape.jpg` 作为全局兜底。

## 注册与加载

在 `src/templates/registry.ts` 增加唯一 ID 和显式 `load` 动态导入。入口组件是该模板唯一的公共入口；布局、动画、拖拽可全部在入口内部实现。注册表是静态代码，不支持远程安装、版本或能力插件。测试专用模板应通过 `App` 的 `templates` 参数注入，不加入生产注册表。

模板切换先加载新入口，成功后再替换 `TemplateHost` 子树。不要给 `App` 或搜索栏设置模板 `key`，以保留未提交搜索词。模板卸载必须清理 RAF、定时器、DOM 监听、Portal、占位和焦点任务，并让旧会话回调失效。

## 样式与 DOM

模板专用样式应在模板入口中引入，并限制在 `data-template="<id>"` 下。Portal 在 `document.body` 下渲染时也要显式带模板标记和所需 CSS 变量，不能依赖公共祖先。公共编辑空白点击只识别标准交互元素上的 `data-editing-interactive`，不要让整个模板根节点成为交互区域。

## 测试

新增纯逻辑测试验证注册表、配置兼容、切换保护和会话释放；浏览器回归使用 `tests/fixtures` 注入普通列表模板，证明第二个模板不依赖气泡 DOM、Motion、dnd-kit 或液态状态机。生产构建输出使用 `/private/tmp/edith-template-phase1-dist`，避免覆盖已有 `dist` 产物。

## 本地验证命令

- `npm run lint`
- `npx tsc -b --pretty false`
- `npm test`：Node 原有测试框架，包含注册表/兼容/移动/液态会话测试。
- `npm run test:e2e -- --workers=1`：Playwright 使用本机 Google Chrome（`channel: chrome`），自动启动 `127.0.0.1:4179` 的 Vite 服务。需要事先安装 Google Chrome。
- `npm run build -- --outDir /private/tmp/edith-template-phase1-dist --emptyOutDir`

E2E 测试只对外部图标、访问目的页、Vercel 分析脚本使用响应替身，不向外部发送测试访问。模板代码、搜索组件、公共配置、选择面板和业务操作全部走真实实现。触屏使用 Chrome CDP 触点序列；当前未覆盖 Safari/Firefox 或真实手机硬件。截图与失败 trace 写到 `/private/tmp`，不进入生产构建或仓库产物。

## 当前阶段范围

本阶段已包含 Matter.js 物理图标模板，用于验证随机碰撞、堆叠和拖拽交互。它与 Bubble 模板共享公共配置、编辑操作、访问统计、持久化和撤销能力；物理世界中的位置和速度仍属于模板私有运行态，不写入配置。

本阶段仍不包含新视觉方向、分类重排/同分类排序、远程模板安装、全局状态库或模板专属持久化配置。公共层不要求任何新模板使用气泡站点组件；可以单独复用 `SiteIcon`，也可以自行实现可访问的站点外观。
