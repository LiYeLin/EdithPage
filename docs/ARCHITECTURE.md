# 代码架构

## 启动与公共状态

`src/main.tsx` 先初始化存储，再挂载 React `StrictMode` 下的 `App` 和 Analytics。扩展模式通过 Vite alias 将 Analytics 替换为 `NoAnalytics`。

`App.tsx` 负责搜索引擎、编辑目标、访问次数、首次引导、撤销和模板选择。`usePersistentConfig` 管理导航配置与持久化；`SettingsDrawer` 通过回调提交站点、分类、主题色和位置保存设置。

数据流为：用户操作 → 模板 `actions` 或设置回调 → App / `usePersistentConfig` 更新 → storage 保存 → 配置重新传入模板。模板不应自行维护另一份业务配置。

## 目录职责

| 路径 | 职责 |
| --- | --- |
| `src/components/` | 搜索、设置、模板选择、引导、图标与常用站点条 |
| `src/hooks/` | 持久化、长按、视口与动态偏好 |
| `src/data/` | 默认分类/站点、搜索引擎和本地图标映射 |
| `src/platform/` | 网页/扩展存储适配、备份、Analytics 空实现 |
| `src/templates/` | 模板协议、注册、选择、配置兼容和各模板实现 |
| `src/effects/` | 气泡高光与液态材质 |
| `src/utils/moveSite.ts` | 跨分类移动的纯数据逻辑 |
| `public/` | 品牌、背景、站点图标、北京地形 |
| `extension/` | 浏览器清单、打包校验脚本、商店资料 |
| `tests/` | 逻辑、组件、浏览器回归和测试夹具 |

## 模板生命周期

`registry.ts` 显式注册四个本地模板并使用动态导入。`useTemplateSelection` 缓存成功加载的入口，用请求序号拒绝取消或过期的异步结果；新模板加载成功后才替换活动模板。

`TemplateHost` 承载模板子树。模板通过 `NavigationTemplateProps` 接收只读数据、编辑/阻断状态、目标站点展示请求、位置配置与公共动作。拖动和归位通过 `{ dragging, settling }` 上报，公共层据此禁止切换。

背景由注册项 `appearance` 配置，App 统一应用到页面；专用 CSS 限制在 `data-template` 范围。模板卸载需释放循环、监听、Portal、观察器和异步任务。详见 [模板接入](TEMPLATE_INTEGRATION.md)。

## 各模板实现

- **气泡**：站点按居中的行排列并预留添加位置，按内容计算气泡边界；工作区使用 D3 和按行候选计算分组位置。Motion 负责布局动画；专用漂浮/液态逻辑负责气泡响应；dnd-kit 负责拖放输入与命中；`liquid-gooey@0.2.1` 负责水滴轮廓。文字和图标位于 SVG 滤镜之外。
- **物理图标**：`MatterTemplate.tsx` 内建立 Matter.js 世界、边界和刚体，将物体位置同步到 DOM 图标，使用 Pointer Events 拖动；支持独立的位置快照。
- **北京地标**：`assets.ts` 加载本地展示/碰撞 SVG，`terrain.ts` 使用 poly-decomp 分解凹多边形并适配视口，`scene.ts` 管理 Matter 世界，`drag.ts` 管理输入。静态列表承担加载失败和减少动态回退。
- **纯净网格**：普通 React/CSS 图标网格，复用公共站点动作，不依赖气泡 DOM 或物理会话。

`src/demos/liquid-gooey/physics.ts` 是独立实验逻辑，不代表额外生产模板。

## 公共行为与资源

`moveSite` 一次更新源/目标分类，保留站点对象和 ID；同分类、缺失目标/来源站点、目标已有同 ID 都保持原对象不变。App 的撤销恢复原索引。

`SiteIcon` 按域名精确匹配本地 SVG。网页端失败后尝试 Google favicon，再回退文字；扩展只使用本地图标或文字。`fast.ai` 直接使用文字标识。网址编辑后按新域名重置失败状态。

本项目没有后端服务、账号或云同步。网页与扩展共用业务源码，通过构建模式和存储适配区分运行环境。
