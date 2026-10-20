# 开发、测试与构建

## 环境与运行

建议 Node.js 22.18+，现有扩展 CI 使用 Node.js 22。仓库没有单独配置 `engines` 限制。安装依赖使用锁文件：

```bash
npm ci
npm run dev
```

常规运行不要求 `.env` 或后端服务。开发服务器地址以 Vite 输出为准。

## 命令与测试层次

| 命令 | 实际行为 |
| --- | --- |
| `npm test` / `npm run test:unit` | Vitest 单次运行逻辑和组件测试 |
| `npm run test:node` | Node 类型剥离运行指定的九个历史测试文件，不涵盖全部新测试 |
| `npm run test:component` | Vitest component 项目 |
| `npm run test:coverage` | V8 覆盖率，输出到 `coverage/` |
| `npm run test:e2e` | Playwright 浏览器回归 |
| `npm run test:all` | 单元/组件测试后运行 E2E |
| `npm run lint` | ESLint |
| `npm run build` / `npm run build:web` | `tsc -b` 后执行网页 Vite 生产构建 |
| `npm run preview` | 预览网页生产构建 |
| `npm run build:extension` / `npm run package:extension` | 类型检查、扩展模式构建、四浏览器打包及内置校验 |
| `npm run validate:extension` | 校验已经生成的四套扩展目录 |

`vitest.config.ts` 将逻辑 `.test.ts/.mjs` 与组件 `.test.tsx` 分开，并兼容指定历史 `node:test` 文件。组件项目使用 `tests/setup.ts`。覆盖率门槛为 statements/functions/lines 80%，branches 75%；这属于配置门槛，不代表每次测试都生成覆盖率。

Playwright 使用本机 Google Chrome（`channel: chrome`），自动启动 `127.0.0.1:4179`，不复用已有服务器。默认 3 workers；稳定排查可用：

```bash
npm run test:e2e -- --workers=1
npm run test:e2e -- tests/e2e/beijing.spec.ts --workers=1
```

浏览器失败时保留 trace 和截图，输出到 `/private/tmp/edith-template-phase1-e2e`。如端口占用或未安装 Google Chrome，需先解决环境问题。移动尺寸与触屏测试是 Chrome 仿真。

测试范围包括气泡布局/高光/漂浮/液态会话、跨分类移动、模板加载、配置与存储、备份、Matter/北京拖动和碰撞、位置持久化、搜索与设置交互。具体用例以 `tests/` 为准，避免在入口文档固定测试数量。

## 产物与扩展

网页默认输出 `dist/`，不要手工修改生成文件。只需验证且不希望改写已有网页产物时，可将输出定向到临时目录：

```bash
npm run build -- --outDir /private/tmp/edith-docs-build
```

扩展构建以 `--mode extension` 启用相对 base、禁用 Analytics 和远程 favicon；先生成 `dist/extension-app`，再复制应用、写入对应 Manifest、校验并压缩。成功后删除中间应用目录。

- 解压目录：`dist/extensions/{chrome,edge,360,qq}`。
- ZIP：`artifacts/edith-{browser}-{package.json.version}.zip`。
- MV3，仅 `storage` 权限，新标签页入口 `index.html`，没有后台、内容脚本或工具栏入口。
- 校验拒绝 source map、远程 HTML 入口资源、已知 Analytics/favicon 服务和额外权限；它不是完整浏览器兼容验收。

安装步骤、兼容目标和版本发布命令见 [扩展说明](../extension/README.md)。Chrome、Edge 是商店目标，360、QQ 是 Windows Chromium 兼容包；产物生成不代表商店已发布。

工作区已有 `.github/workflows/release-extension.yml`：手动运行上传 14 天工作流产物，匹配 `vX.Y.Z` 的 tag 推送在检查成功后创建公开 GitHub Release。版本必须与 package、锁文件一致，tag 提交须位于 main。该流程不执行 E2E，也不自动提交到浏览器商店。

## 修改后检查

按仓库要求运行 `npm test`、`npm run lint`、`npm run build`；UI 或拖动逻辑变化再运行对应浏览器回归，扩展路径变化则额外构建并校验扩展。

更新文档时区分当前实现、历史研究和待定需求。保留本地已有修改，不自动提交、推送或发布。
