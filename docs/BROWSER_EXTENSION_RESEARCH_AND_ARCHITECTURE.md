# Edith 跨浏览器扩展调研与通用方案

> 调研日期：2026-09-29  
> 范围：中国大陆桌面端浏览器、新标签页扩展、公开商店分发  
> 结论有效期建议：每次正式提审前重新核对

## 结论

Edith 应采用“一套业务代码、多个浏览器包”的方案：

- 以 Chromium Manifest V3（MV3）作为唯一主线，Chrome、Edge、360、QQ 共用业务代码并分别生成清单和安装包。
- 360、QQ 作为最新版 Windows Chromium 内核的兼容目标，不承诺商店上架；360 公开开发文档仍大量停留在 MV2 时代，QQ 没有公开、可复现的开发者提交入口。
- v1 只做“新标签页导航”这一项单一用途，权限仅申请 `storage`，不申请网页访问、历史、标签页、Cookie 等权限，也不需要后台 Service Worker。
- 扩展包必须完全本地化：移除扩展版中的 Vercel Analytics，停止默认请求 Google favicon 服务，所有可执行代码和首屏资源随包发布。

推荐顺序：**Edge → Chrome → 360/QQ 兼容验证 → 搜狗兼容验证**。Edge、Chrome 走正式商店流程；360、QQ 仅生成兼容安装包并等待有效发布渠道。

## 1. 浏览器名单与统计口径

“拥有率”没有公开、统一、可审计的口径。厂商常公布装机量、累计用户、月活或产品矩阵数据，不能和浏览器流量份额直接比较。本报告使用 **StatCounter 中国大陆桌面端网页流量份额**作为可复核的近似指标，不将它表述为装机率。

用户要求“前三外加 Chrome、Edge”，这里解释为“国产桌面浏览器前三 + Chrome、Edge”。若按全部品牌直接排序，前三本身就是 Chrome、Edge、360，不需要再额外添加 Chrome 和 Edge。

| 浏览器 | 2026-08 中国桌面流量份额 | 本报告定位 |
| --- | ---: | --- |
| Chrome | 52.38% | 国际基准、MV3 主目标 |
| Edge | 26.78% | 主发布目标 |
| 360 安全浏览器 | 8.48% | 国产第一、独立提审目标 |
| QQ 浏览器 | 3.69% | 国产第二、兼容目标 |
| 搜狗浏览器 | 1.65% | 国产第三、低优先级兼容目标 |

五者合计约 92.98%。数据来自 [StatCounter 中国桌面浏览器份额](https://gs.statcounter.com/browser-market-share/desktop/china)；StatCounter 页面只直接展示前六名，搜狗的 1.65% 可在引用同一份 2026-08 数据的[完整榜单](https://m.ithome.com/html/996687.htm)中核对。

限制：

- 数据按网页访问量统计，会受样本站点、UA 识别和 Chromium 分支归类影响。
- 360 的上市公司报告曾披露其“PC 浏览器及导航”MAU 4 亿+、市场占有率 86.5%+，但该口径包含“浏览器及导航”，且分母未公开，不能与 StatCounter 混用。[360 2024 年半年度报告](https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2024-08-31/601360_20240831_M8VP.pdf)
- 如果项目决策必须依据“安装拥有率”，应另购 QuestMobile、艾瑞等同口径面板数据，并要求提供桌面端、浏览器品牌、活跃设备去重和时间窗口定义。

## 2. 共同技术基础

五款浏览器的可扩展部分都与 Chromium 扩展模型有直接关系。共同抽象是：

- `manifest.json` 描述名称、版本、页面、权限和资源。
- 新标签页通过 `chrome_url_overrides.newtab` 指向扩展内 HTML。Chrome 官方明确支持新标签页替换，并要求页面快速、轻量，且新标签默认焦点在地址栏。[Chrome 新标签页替换文档](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- 扩展页面使用 HTML/CSS/JavaScript；浏览器能力通过 `chrome.*` 扩展 API 暴露。
- 商店分发通常上传 ZIP，商店负责签名、生成扩展 ID、审核和自动更新。
- 本地开发都可通过开发者模式加载解压目录；它只能用于开发、内测或企业分发，不应作为面向消费者的正式安装方案。

### MV3 的共同约束

Chrome 已在 2025 年全面停用 MV2，并于 2026-08-31 从商店移除剩余 MV2 扩展，因此新项目必须以 MV3 为主线。[Chrome MV2 停用时间线](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)

MV3 的关键变化包括：

- 持久后台页改为按需唤醒的 Service Worker。
- 扩展不能执行远程托管的 JavaScript；可执行代码必须包含在审核包内。
- 网络拦截更多使用 `declarativeNetRequest`，而不是阻塞式 `webRequest`。

Edith v1 只是新标签页，不需要后台任务，所以可以完全不声明 `background`，从根源上减少 MV2/MV3 差异和审核面。[Chrome MV3 概览](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

## 3. 各浏览器差异

### 3.1 Chrome

技术：

- 当前商店只接受 MV3 新扩展。
- 新标签页替换、`chrome.storage`、可选权限、Options 页面等都有完整且持续维护的官方文档。
- `chrome.storage.local` 默认限额 10 MB；`storage.sync` 约 100 KB，且按单项限额。扩展 Service Worker 不能使用 `localStorage`。[Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- 对 Edith 而言，只需 `storage` 权限和 `chrome_url_overrides`，不需要主机权限。

上架门槛：

- 开发者账号需要一次性注册费；2026 年官方更新仍以 5 美元描述，实际金额和可支付地区以注册页为准。[账号注册说明](https://developer.chrome.com/docs/webstore/register)、[2026 扩展更新记录](https://developer.chrome.com/docs/extensions/whats-new)
- 发布或更新前要求开发者账号开启两步验证。
- 新扩展、新开发者、危险权限、广泛主机权限、代码量大或难审查都会增加审核时间。
- 常规审核为数天，可能延长至数周；超过三周可联系支持。[Chrome 审核流程](https://developer.chrome.com/docs/webstore/review-process)
- 必须具备单一、清晰用途；权限与用途匹配；数据收集真实披露；处理用户数据时提供隐私政策；禁止混淆代码、远程可执行代码、误导性元数据和评分操纵。[Chrome 商店政策](https://developer.chrome.com/docs/webstore/program-policies/policies)

对 Edith 的特殊要求：明确写成“替换新标签页的可配置导航”，不要同时宣传为搜索劫持、广告工具、购物返利或通用工具箱。

### 3.2 Microsoft Edge

技术：

- Edge 基于 Chromium，Chrome 的清单键和主要扩展 API 基本兼容。
- 从 Chrome 包迁移时，官方要求检查 API 差异、删除 `update_url`、移除名称或描述中的 Chrome 品牌并重新测试。[迁移 Chrome 扩展到 Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- 少数 API 存在差异，尤其身份认证、支付、商店和 Native Messaging 的扩展 ID。
- 商店上传 ZIP，发布后转为 CRX；开发模式和企业策略是无需商店托管的两个官方例外。[Edge 扩展托管](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/hosting-and-updating)

上架门槛：

- Edge 扩展开发者注册免费，可注册个人或公司账号；公司账号需要额外验证。[Edge 开发者注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)
- 通过 Partner Center 提交，官方给出的认证时间上限为 7 个工作日。
- 需要说明单一用途、逐项解释权限、披露数据用途、提供可访问的隐私政策和必要的测试账号。
- 远程代码会触发额外审核；混淆代码不允许；设置变更必须获得用户同意且可恢复。[Edge 发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)、[Edge 扩展政策](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)

### 3.3 360 安全浏览器

技术：

- 360 提供独立扩展开放平台、扩展中心、CRX 打包和 `chrome.*` API 文档，也明确支持替换新标签页。[360 新标签页替换文档](https://open.se.360.cn/open/extension_dev/override.html)
- 公开清单文档仍以 `manifest_version: 2`、后台页、NPAPI 等旧模型为主，明显落后于当前 Chromium；不能把它当作 MV3 支持矩阵。[360 Manifest 文档](https://open.chrome.360.cn/extension_dev/manifest.html)
- 360 安全、360 极速、360 极速 X 的内核和扩展中心存在版本差异。官网显示极速 X 支持 Chrome 扩展，但 Edith 仍需分别真机验证。[360 极速 X](https://chromex.360.cn/)
- 双核浏览器的扩展能力应按 Chromium“极速模式”测试，不把 IE/兼容模式视为扩展运行环境。

上架门槛：

- 当前页面要求上传不超过 20 MB 的 ZIP，其中包含 CRX、功能说明、96×96 图标和 1–5 张 560×350 截图。
- 审核标准要求真实完整的信息、最小权限、隐私政策、访问个人信息前授权、数据最小化、HTTPS、禁止后台静默抓取无关网页数据、禁止出售个人信息。
- 必须提供账号注销和清除本地数据的途径，隐私投诉等请求需在 15 个工作日内响应。
- 禁止远程外部脚本、JavaScript 加密或混淆、恶意广告、搜索/主页/新标签页劫持。平台同时提供合法的新标签页替换 API，Edith 提审时必须突出“用户主动安装、单一用途、可卸载”，并在提交前向平台确认不会被按“劫持”处理。
- 页面要求产品研发归属与注册公司信息一致，个人开发者能否稳定提审需要在正式排期前确认。
- 平台页面曾给出 14 个工作日审核目标，当前标准页只承诺通过邮箱通知；项目计划按 2–3 周预留，不把时效当 SLA。

详见 [360 当前审核标准](https://open.se.360.cn/open/standard.html) 和 [360 上传要求](https://open.chrome.360.cn/extension_dev/upload.html)。费用未见公开说明，不能写成“免费”。

### 3.4 QQ 浏览器

已确认：

- QQ 浏览器应用中心官方页面称可提供 Chromium 扩展应用，说明其扩展格式与 Chromium 生态存在兼容关系。[QQ 浏览器应用中心](https://appcenter.browser.qq.com/)
- 公开页面没有给出当前开发者注册、上传、审核、隐私申报、费用或审核周期。
- 页面仍显示 2016 年版权信息，不能据此判断当前 MV3 API、自动更新和商店收录机制。

结论：QQ 浏览器只列为兼容性目标。先在最新 Windows 版验证解压加载、CRX 安装、MV3、`chrome_url_overrides`、`chrome.storage` 和升级迁移；在腾讯提供书面或可复现的公开提交入口前，不承诺商店上架时间。

### 3.5 搜狗浏览器

已确认：

- 官方帮助仍说明浏览器有扩展中心，可安装、停用和删除扩展。[搜狗扩展帮助](https://ie.sogou.com/help/help-3-5.html)
- 官方帮助给出开启开发者模式、把插件文件拖入扩展管理页的侧载方式。[搜狗侧载帮助](https://ie.sogou.com/help/help-2-19.html)
- 官方帮助仍描述 WebKit 高速模式与 IE 兼容模式的双核结构。[搜狗内核切换](https://ie.sogou.com/help/help-4-7.html)
- 没有找到当前公开的开发者提交、审核、费用和审核周期；帮助中的“搜应用中心”链接当前也不能形成可复现的开发者发布链路。

结论：搜狗优先级最低，仅做最新版本的手工兼容测试。扩展只按高速模式支持；不为兼容模式做额外实现，不把开发者模式侧载当作消费者分发方案。

## 4. 推荐架构

### 4.1 两层边界

Edith 当前已有模板注册表，它解决的是应用内部主题/模板切换；浏览器扩展是外层交付容器，两者不要混为一个“插件系统”。

```text
浏览器商店包
├── manifest + newtab.html
├── 平台适配层（storage/runtime）
└── Edith Web 应用
    ├── 公共导航业务
    └── 编译期模板注册表（bubble/matter/beijing/plain）
```

本阶段不引入远程模板市场、远程 JavaScript 或运行时安装代码。远程代码既增加供应链风险，也直接触碰 Chrome MV3 和 360 审核红线。

### 4.2 建议目录

```text
src/
  entries/
    web.tsx
    newtab.tsx
  platform/
    types.ts
    web-storage.ts
    extension-storage.ts
    index.ts
  templates/                 # 保留现有内部模板系统
extension/
  manifests/
    base.mv3.json
    chrome.json
    edge.json
    360.json
    legacy.mv2.json          # 仅真机证明必要后启用
  assets/
scripts/
  build-extension.mjs
dist-extension/
  chrome/
  edge/
  360/
  qq/
  sogou/
```

`base.mv3.json` 建议保持最小：

```json
{
  "manifest_version": 3,
  "name": "Edith",
  "version": "0.1.0",
  "description": "可配置的新标签页导航",
  "permissions": ["storage"],
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "icons": {
    "16": "icons/16.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  }
}
```

v1 不声明以下内容：

- `background`：没有后台任务就不要创建 Service Worker。
- `host_permissions` / `content_scripts`：Edith 不需要读取或修改任意网页。
- `tabs` / `history` / `topSites`：当前常用站点由 Edith 自己统计，不读取浏览器历史。
- `externally_connectable`、Native Messaging、远程更新地址。

### 4.3 平台接口

先只抽象确实存在差异的能力，不做大而全框架：

```ts
export interface EdithStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
}
```

- Web 版由 `localStorage` 适配器实现。
- 扩展版由 `chrome.storage.local` 实现。
- App 启动改为异步读取配置，读取完成前只显示本地骨架，避免默认配置闪烁后被覆盖。
- 现有 `edith-navigation-config-v3` 等数据结构和键名保留。网页域与扩展域的 `localStorage` 互相隔离，已部署网页的数据应通过 JSON 导入/导出迁移；只有曾用同一扩展 ID 发布过旧版时，才能在扩展域内做一次 `localStorage` → `chrome.storage.local` 迁移。
- 跨浏览器同步暂缓。Chrome、Edge、360、QQ、搜狗的账号同步并不互通；首版应提供 JSON 导入/导出作为可控迁移方案。

### 4.4 构建与兼容策略

- Vite 公共资源路径改为相对路径，确保 `chrome-extension://<id>/...` 下可加载。
- 构建阶段合并基础清单与目标差异，不在运行时根据 UA 切换能力。
- Chrome、Edge、360、QQ 均输出独立 MV3 包；360、QQ 必须在 Windows 最新稳定版真机验证。
- 不生成 MV2 或 CRX，不在仓库保存签名私钥；无法加载 MV3 的旧版本明确标记为不支持。
- 扩展版本号与应用版本号统一；每个目标的商店 ID、上传记录和哈希单独保存。

## 5. 当前项目需要先处理的审核风险

| 当前实现 | 风险 | 建议 |
| --- | --- | --- |
| `src/main.tsx` 引入 `@vercel/analytics/react` | 远程请求、数据披露、扩展 CSP 和审核风险 | 扩展构建完全移除；未来如需统计，单独设计用户可关闭的第一方最小事件方案 |
| `src/data/siteIcons.ts` 默认请求 Google favicon | 在大陆可能不可达，并把用户配置的域名发送给第三方 | 扩展版只用随包图标和文字回退；远程图标必须改为显式选择并在隐私政策披露 |
| 配置、访问次数、引导状态使用 `localStorage` | 不能与 Service Worker 共用，清理浏览数据时行为不稳定 | 迁移到平台存储接口；扩展使用 `chrome.storage.local` |
| 多个模板通过动态 `import()` 加载 | 构建后本地 chunk 合法，但需要确认所有 chunk 都包含在包内 | 构建后扫描 HTML/JS，禁止任何远程脚本和远程模块地址 |
| 新标签页包含多种模板和设置 | 可能被误判为多用途 | 商店文案统一归入“可配置新标签页导航”；模板只是同一用途的外观与交互选项 |
| 站点品牌图标 | 可能触发商标/素材权属审查 | 保留 `public/site-icons/README.md` 的授权记录，商店宣传图避免暗示品牌合作 |

## 6. 提审基线

所有商店共用一套材料：

- 单一用途说明：替换新标签页，帮助用户整理和访问自定义站点。
- 权限说明：只用 `storage` 保存用户主动创建的导航配置和本地使用次数。
- 隐私政策：列明收集项、用途、保存位置、保存期限、第三方、删除方式、联系邮箱；即使首版不上传数据，也建议提供。
- “清除本地数据”按钮、JSON 导出/导入、卸载说明。
- 可长期访问的官网、支持邮箱、隐私政策 URL。
- 128×128 图标、各商店要求的截图和宣传图，内容与实际功能一致。
- 审核备注：无需登录、无需测试账号、无远程代码、无广告、无付费、无内容脚本、无网页读取。
- 可读源码和 source map 内部留档；提交包不包含密钥、`.env`、测试数据或开发服务器地址。

中国大陆用户数据合规底线：处理个人信息前应清晰告知处理者、目的、方式、种类、保存期限和权利行使方式；用户应能撤回同意。若以后把用户导航、使用次数或账号数据传至境外，还要评估个人信息出境义务。[《个人信息保护法》](https://www.npc.gov.cn/WZWSREL25wYy8vLy8vL2MyL2MzMDgzNC8yMDIxMDgvdDIwMjEwODIwXzMxMzA4OC5odG1s)、[《网络数据安全管理条例》](https://www.cac.gov.cn/2024-09/30/c_1729384452307680.htm)、[《促进和规范数据跨境流动规定》](https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm)。这部分需要在实际数据流确定后由法务复核。

## 7. 测试与发布门禁

自动化：

- Chrome、Edge 使用 Playwright persistent context 加载解压扩展；360、QQ 产物进入同一静态校验矩阵。
- 校验新标签替换、首次启动、配置保存、版本升级迁移、离线启动、导入导出和 `prefers-reduced-motion`。
- 对构建产物执行静态检查：无 `http://`、无远程 `.js`、无未声明权限、无 sourcemap 泄漏、无超限包体。

真机：

- Windows 10、Windows 11 各测一次最新 Chrome、Edge、360 安全、360 极速 X、QQ、搜狗。
- 360/QQ/搜狗记录浏览器版本、Chromium 版本、MV3 是否可加载、扩展 ID、存储行为和新标签替换确认提示。
- 双核浏览器只验极速模式；兼容模式不在支持范围。
- 检查卸载后扩展数据和新标签设置是否恢复，升级是否保留配置。

发布门禁：

1. `npm test`、`npm run lint`、`npm run build` 全部通过。
2. Chrome 与 Edge 自动化扩展测试通过。
3. 目标商店的最新政策重新核对并归档日期。
4. 隐私政策与实际网络请求抓包一致。
5. 各目标包使用同一 Git commit 生成并记录 SHA-256。
6. Edge/Chrome 首发稳定后再评估国产浏览器发布渠道；兼容包不等同于商店就绪。

## 8. 实施阶段

### 阶段一：扩展壳

- 增加 `newtab.html`、MV3 清单、扩展图标和多目标构建脚本。
- 引入存储适配层，把现有四组持久化数据改接 `chrome.storage.local`，并提供网页数据 JSON 导入。
- 移除扩展版 Analytics 和远程 favicon。
- 补 Chrome/Edge 自动化测试。

### 阶段二：发布

- 完成隐私政策、支持页、商店文案和截图。
- 先提交 Edge，再提交 Chrome。
- 记录审核反馈并把共性修正合入基础包。

### 阶段三：国产浏览器

- 在最新 360 安全浏览器极速模式、360 极速浏览器 X 和 QQ 浏览器做 MV3 真机验证。
- 360、QQ 仅发布兼容 ZIP；取得有效渠道并重新确认审核政策后，另行规划商店提交。
- 搜狗只在通过兼容测试且取得有效发布渠道后排期，不维护 MV2 分支。

## 9. 最终决策

首版正式支持矩阵：

| 层级 | 浏览器 | 承诺 |
| --- | --- | --- |
| Tier 1 | Chrome、Edge | 正式商店发布、自动化回归 |
| Tier 2 | 360 安全/极速 X、QQ | MV3 兼容安装包，真机通过后标记支持，不承诺商店上架 |
| Tier 3 | 搜狗 | 尽力兼容，不提供首版构建产物 |

这套方案保留了当前 React/Vite 和模板体系，不需要重写 UI；主要改造集中在存储、构建入口、远程依赖清理、清单生成和发布材料。它也避免为了不透明的国内旧扩展平台，把整个项目锁死在 MV2。
