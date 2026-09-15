---
name: edith-template-development
description: 为 Edith 导航站设计、实现、审查和测试模板。只要用户提到 Edith 模板、模板切换、新增职业模板、模板注册、导航内容布局，或要把一套新视觉接入现有导航站，就使用本 skill。它会先读取当前模板协议和共享业务边界，再以最小变更创建可切换、可访问、可响应式、可测试且不破坏现有数据的 React/TypeScript 模板。
---

# Edith 模板开发

## 目标

模板只负责“如何展示和交互”，公共层负责“数据是什么、如何修改、如何持久化”。新增模板应当像替换一个视图一样接入，而不是复制一套 App、设置抽屉、搜索或数据存储。

先把需求分成两类：

- **已确认的公共能力**：搜索、分类与站点数据、访问统计、编辑表单、删除撤销、模板选择、配置持久化。
- **模板私有体验**：布局、动效、拖拽呈现、分页、视觉材质、模板内部的编辑入口。

不要把未确认的产品想法（云端同步、账号、远程安装模板、模板专属配置、更多职业模板）当成现有能力。

## 开始前：读取事实来源

在改代码前，按顺序查看：

1. `src/templates/types.ts`：模板输入协议和公共动作。
2. `src/templates/registry.ts`：生产模板 ID、名称、说明和动态加载方式。
3. `src/templates/TemplateHost.tsx`：挂载、卸载、`inert` 和交互状态包装。
4. `src/templates/useTemplateSelection.ts`：加载前切换、缓存、取消、重试和过期请求保护。
5. `src/templates/config.ts`、`src/hooks/usePersistentConfig.ts`：模板 ID 兼容、切换和持久化规则。
6. `src/App.tsx`：公共状态、编辑动作、撤销、模板切换和搜索边界。
7. `docs/TEMPLATE_INTEGRATION.md`：接入约束和测试边界。
8. 参考实现：`src/templates/plain/`（简单模板）和 `src/templates/bubble/`（复杂动效与拖拽模板）。

如果代码与文档冲突，以当前代码和测试为准，并在交付说明中指出冲突，不要默默扩展协议。

## 当前架构

### 公共层

`App` 持有并传入：

- `modules: readonly Module[]`：分类及其站点。数据类型见 `src/types.ts`。
- `frequentSites: readonly FrequentSiteItem[]`：公共“最常使用”列表，当前由访问次数排序并限制数量。
- `editing`：全局编辑模式。
- `interactionBlocked`：设置抽屉、模板选择器、模板加载中等场景下为 `true`。
- `revealSite: { moduleId: string; siteId: string } | null`：一次性定位请求；分页或滚动模板应消费它。
- `actions`：编辑、删除、添加、移动、访问和打开设置的公共动作。
- `onInteractionStateChange({ dragging, settling })`：模板向公共层报告切换保护状态。

公共配置只有 `templateId` 表示当前模板；分类、站点和主题色属于共享内容。切换模板通过 `selectTemplate` 保留共享内容，恢复默认内容通过 `resetContent` 保留当前模板 ID。

当前浏览器持久化由 `usePersistentConfig` 负责，不能在模板中另建一份分类或站点存储。当前原型的配置和使用次数使用独立的 `localStorage` 键；不要据此声称存在后端、账号或云同步。

### 模板层

每个模板有一个唯一入口组件和一个专属目录：

```text
src/templates/<template-id>/
├── <TemplateName>.tsx   # 唯一公共入口
├── <template-id>.css    # 仅模板样式
└── ...                  # 仅该模板需要的布局、动效、拖拽和运行时模块
```

模板入口可以组合专属子组件，但不得反向依赖另一个模板的私有运行时、DOM 结构、状态机或 CSS。

## 模板协议

### `TemplateDefinition`

在 `src/templates/registry.ts` 增加一项：

```ts
{
  id: 'my-template',
  name: '我的模板',
  description: '一句话说明展示方式和主要交互。',
  editingHint: '告诉用户如何进入编辑、编辑、移动和退出。',
  load: () => import('./my-template/MyTemplate'),
}
```

规则：

- `id` 必须唯一、稳定、适合持久化；不要使用显示名称或随机值。
- `load` 必须是显式动态导入。这样模板代码不会全部进入首屏，并且切换失败时可以保留旧模板。
- 入口模块必须默认导出 `ComponentType<NavigationTemplateProps>`。
- 测试专用模板通过 `App` 的 `templates` 参数注入，不要加入生产注册表。
- 不要在注册表里引入远程 URL、版本插件或运行时安装机制；当前注册表是静态代码目录。

### 最小入口骨架

```tsx
import './my-template.css'
import type { NavigationTemplateProps } from '../types'

export default function MyTemplate({
  modules,
  frequentSites,
  editing,
  interactionBlocked,
  revealSite,
  actions,
  onInteractionStateChange,
}: NavigationTemplateProps) {
  // 无拖拽/收尾动画的模板也应明确报告空闲状态。
  onInteractionStateChange({ dragging: false, settling: false })

  return (
    <section
      data-template="my-template"
      aria-label="我的模板"
      inert={interactionBlocked}
    >
      {/* 使用 modules、frequentSites 和 actions 渲染模板私有界面。 */}
    </section>
  )
}
```

实际代码中不要在渲染函数直接调用副作用；使用 `useEffect` 报告初始/卸载状态。入口应保持薄，复杂逻辑拆到同目录的子组件、hook 或纯函数中。

## 公共动作的正确语义

模板不得直接修改 `modules` 或 `localStorage`，只调用 `actions`：

| 动作 | 用途 | 注意 |
|---|---|---|
| `enterEditMode()` | 长按、编辑按钮或模板入口进入编辑 | 普通浏览模式不要显示破坏性编辑控件 |
| `openSettings()` | 打开公共设置抽屉 | 用于新增分类或全局添加站点 |
| `addSite(moduleId)` | 打开指定分类的添加站点表单 | 不要在模板内复制表单逻辑 |
| `edit(target)` | 编辑站点或分类 | target 使用 `EditorTarget` 结构 |
| `removeSite(moduleId, siteId)` | 删除站点并触发公共撤销 | 不要自行删除数组或做第二次提交 |
| `removeModule(moduleId)` | 删除分类并触发公共撤销 | 不要把撤销实现复制到模板 |
| `moveSite(move)` | 提交跨分类或同分类移动 | 仅成功移动才返回 `true`；预览/悬停不提交 |
| `visitSite(siteId)` | 在站点链接点击时记录访问 | 不要用模板私有 ID 替代站点 ID |

站点链接应保留真实 URL、`target="_blank"`、`rel="noreferrer"` 和可理解的 `aria-label`。可复用 `src/components/SiteIcon.tsx`；它已经包含 favicon 来源轮换和首字母回退。

## 编辑、拖拽与切换保护

### 编辑模式

- 普通模式优先导航：不要把添加、编辑、删除控件常驻在每个站点上。
- 编辑控件必须是真实的 `button`、`select`、`input` 或链接；使用明确的 `aria-label`。
- 需要阻止“点击空白退出编辑”的控件或容器加 `data-editing-interactive`。不要把整个模板根节点标为交互区域，否则空白点击失效。
- `interactionBlocked` 为真时，模板根或可操作子树应使用 `inert`，避免用户同时操作设置面板和模板。
- 保留键盘焦点、`focus-visible` 样式和 Escape 退出等公共行为，不用鼠标专属手势替代可访问操作。

### 拖拽或视觉收尾

`onInteractionStateChange` 只有两个布尔字段：

1. 提起并拖动时：`{ dragging: true, settling: false }`。
2. 松手后视觉还在归位/融合时：`{ dragging: false, settling: true }`。
3. 成功收尾、取消、超时和卸载后：`{ dragging: false, settling: false }`。

公共层在 `dragging` 或 `settling` 时拒绝模板切换。模板必须让旧会话失效，并在卸载时释放 RAF、定时器、DOM 监听、Portal、占位、焦点任务和 pointer/keyboard 捕获。

拖拽数据边界：

- 悬停只改变视觉预览，不修改真实分类。
- 有效放下时一次调用 `actions.moveSite`；不要在动画帧或重复事件中提交。
- 同分类、无效落点和取消不产生数据变更。
- 装饰性液态层、阴影、吸附或高亮不能改变真实 droppable 命中区域。
- 如果模板支持分页/滚动，成功移动或撤销后用 `revealSite` 展示目标站点；不能只完成数据移动却让站点不可见。
- “最常使用”可以作为来源，但不是可接收的分类；不要把它当作新的业务模块。

## 样式与 DOM 隔离

模板 CSS 必须以模板标记为边界：

```css
:where([data-template="my-template"]) .my-panel { ... }
```

遵循以下原则：

- 模板根节点带 `data-template="<id>"`，ID 与注册表一致。
- 不写裸的全局 `.button`、`body`、`a` 或通用标签规则覆盖其他模板。
- Portal 挂到 `document.body` 时，Portal 根也要带模板标记，并显式提供依赖的 CSS 变量；不能依赖已脱离的公共祖先。
- 模板专用变量以模板前缀命名，公共变量只读取不重定义。
- 响应式至少验证桌面和窄屏；优先保证页面不产生横向溢出，站点列表可局部滚动。
- 动效只服务于层级、状态和反馈；装饰层不可包住或模糊真实 favicon、文字、按钮。
- 遵守 `prefers-reduced-motion`。关闭复杂滤镜或动画时，导航、编辑、移动和取消能力仍然可用。

## 推荐实现顺序

1. 写清模板的视觉模型和交互模型：模块如何排布、站点如何浏览、编辑入口在哪里、移动是否支持。
2. 阅读协议、公共层和参考模板，确认不需要新增公共状态或配置字段。
3. 创建模板目录和入口，先实现静态正常浏览态。
4. 接入共享 `modules`、`frequentSites` 和站点链接。
5. 接入编辑、添加、删除、分类移动、访问统计和空状态。
6. 再加入模板私有动效/拖拽；动效失败不能让业务功能失败，必要时提供静态回退。
7. 注册动态加载并验证切换时搜索输入、搜索引擎、配置和撤销状态不被重置。
8. 增加纯逻辑测试和浏览器回归，再做视觉检查。

## 测试与验收清单

### 纯逻辑

至少覆盖：

- 生产模板 ID 唯一且默认模板稳定。
- 未知 `templateId` 只回退模板 ID，不丢失已有模块、站点和主题色。
- 切换模板保留共享内容；恢复默认内容保留当前模板 ID。
- `dragging` 或 `settling` 时禁止切换。
- `moveSite` 的成功、无效、重复调用和索引恢复语义。
- 模板运行时清理不会留下旧会话回调或视觉占位。

### 浏览器回归

使用 `tests/fixtures/ListTemplate.tsx` 这类“不依赖气泡 DOM、Motion、dnd-kit 或液态状态机”的模板证明公共协议真正独立。至少验证：

- 新模板可以动态加载、切换、刷新后恢复。
- 旧模板加载失败或取消时，旧树和配置仍安全。
- 搜索输入 DOM、未提交查询和搜索引擎在切换后保留。
- 编辑/访问/移动/撤销走公共实现，模板之间结果一致。
- 设置抽屉、模板选择器打开时模板不可操作；关闭后焦点合理恢复。
- 空白退出编辑不会被模板真实交互区域误触发。
- 桌面和移动窄屏无页面级横向溢出；站点自身的横向列表可以局部滚动。
- 控制台无新增 page error；减少动态模式仍可用。

### 命令

在不覆盖已有构建产物的前提下运行：

```bash
npm run lint
npx tsc -b --pretty false
npm test
npm run test:e2e -- --workers=1
npm run build -- --outDir /private/tmp/edith-template-check-dist --emptyOutDir
```

如果某项因环境缺少 Chrome、真实移动 Safari 或外部 favicon 不可验证，要明确写出“未验证”，不要把源码检查当成运行时证据。

## 不要做的事情

- 不复制 `App.tsx`、`SearchDeck`、`SettingsDrawer` 或持久化逻辑到模板目录。
- 不用模板显示名称作为 ID，不在运行时随机生成注册 ID。
- 不给 `<App>`、搜索栏或公共根节点设置模板 `key`；切换只应替换 `TemplateHost` 内部子树。
- 不把模板私有 DOM、气泡类名、液态状态或 dnd-kit 实现写进公共协议。
- 不在悬停、逐帧动画或多个事件回调中重复写配置。
- 不用新增全局状态库、远程模板下载或模板专属持久化解决当前布局问题。
- 不以“构建通过”推断真实浏览器交互、移动端流畅度或生产部署已验证。

## 交付说明

完成模板后，简短说明：

1. 新增/修改的绝对路径和模板 ID。
2. 模板如何展示模块、站点、最常使用和空状态。
3. 使用了哪些公共 actions，是否支持拖拽/分页/动效。
4. 清理、无障碍、响应式和减少动态如何处理。
5. 实际运行过的命令及结果；未运行或未验证的边界。

如果模板协议本身不足以表达需求，先提出最小的公共协议变更及兼容影响，再实现模板；不要在模板内部偷偷绕过公共边界。
