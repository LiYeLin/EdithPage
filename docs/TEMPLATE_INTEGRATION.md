# 模板接入说明

模板是搜索区以下内容的完整入口，公共层负责数据、编辑表单、访问统计、持久化和撤销。新增模板不需要修改顶部、搜索或站点业务逻辑。

## 公共协议

在 `src/templates/types.ts` 实现 `NavigationTemplateProps`。模板只读 `modules` 与 `frequentSites`，使用 `actions` 执行编辑、访问和跨分类移动。`revealSite` 是一次性展示请求；模板可以自行定位、分页或滚动。

`onInteractionStateChange` 只报告 `{ dragging, settling }`：输入拖拽期间设 `dragging: true`，释放后如果视觉仍未完成则设 `settling: true`，收尾或取消时恢复两个 `false`。不要通过交互状态上报逐帧位置。公共层会在这两种状态下拒绝模板切换。

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
- `npm test`：Vitest 单元/组件测试，包含注册表、兼容、移动、液态会话与物理地形测试。
- `npm run test:e2e -- --workers=1`：Playwright 使用本机 Google Chrome（`channel: chrome`），自动启动 `127.0.0.1:4179` 的 Vite 服务。需要事先安装 Google Chrome。
- `npm run build -- --outDir /private/tmp/edith-template-phase1-dist --emptyOutDir`

E2E 测试只对外部图标、访问目的页、Vercel 分析脚本使用响应替身，不向外部发送测试访问。模板代码、搜索组件、公共配置、选择面板和业务操作全部走真实实现。触屏使用 Chrome CDP 触点序列；当前未覆盖 Safari/Firefox 或真实手机硬件。截图与失败 trace 写到 `/private/tmp`，不进入生产构建或仓库产物。

## 当前阶段范围

本阶段已包含 Matter.js 物理图标模板，用于验证随机碰撞、堆叠和拖拽交互。它与 Bubble 模板共享公共配置、编辑操作、访问统计、持久化和撤销能力；速度、约束等仍属于模板私有运行态；用户开启“保存图标位置”后，只通过公共动作保存位置与角度。

本阶段仍不包含分类重排/同分类排序、远程模板安装或全局状态库。公共层不要求任何新模板使用气泡站点组件；可以单独复用 `SiteIcon`，也可以自行实现可访问的站点外观。


## 北京地标模板

`beijing` 是独立动态加载的入口，目录为 `src/templates/beijing/`。它复用公共 `SiteIcon`、`FrequentSiteStrip` 和编辑动作，不依赖 `matter` 模板私有组件或样式，与物理图标模板共用位置保存协议和通用设置抽屉。

三座线稿建筑与静态碰撞体共用一个响应式布局结果。物理运行时以站点 ID 增量同步，不因名称编辑重启；仅真实拖拽报告切换保护，自然下落不阻断切换。失败/减少动态回退为静态列表，暂停和清理由模板运行时集中管理。素材和测试细节见 `public/terrain/README.md`。


## 可选图标位置持久化

通用设置抽屉仅对 `matter` / `beijing` 显示“保存图标位置”。`NavigationConfig.iconPositionPersistence` 下的两个同名槽位各自包含 `enabled` 和按站点 ID 索引的 `positions`。缺失字段默认关闭；加载旧配置不主动改写存储；非法坐标单独忽略，不影响共享内容。

模板接收当前槽位，通过 `actions.saveIconPositions(templateId, positions)` 提交完整快照，App 过滤非法/已删除站点并由 `usePersistentConfig` 同步写入原配置键。坐标为图标中心点相对舞台宽高的比例，`angle` 为弧度。只在拖拽释放、页面隐藏、`pagehide`、尺寸变化和卸载时保存，不逐帧写入。重复快照不再次写入。

关闭后忽略但保留旧位置，再次打开可恢复；恢复默认内容会清除两个槽位。站点名称/分类变化不会重建已有物理 body，新站点仍从顶部掉落；下一次快照清理删除的 ID。窗口变化按相对坐标缩放，并校正边界（北京模板同时校正建筑碰撞）。恢复后初速度归零，仍支持正常物理交互；速度和碰撞约束不持久化。
