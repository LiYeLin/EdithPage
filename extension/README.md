# Edith 浏览器扩展

扩展使用 Manifest V3，仅替换新标签页并申请 `storage` 权限。Chrome、Edge、360 和 QQ 共用应用源码，构建时分别生成安装包。

## 构建

```bash
npm run build:extension
```

生成结果：

- 解压目录：`dist/extensions/{chrome,edge,360,qq}`
- 安装包：`artifacts/edith-{chrome,edge,360,qq}-{version}.zip`

单独校验已有产物：

```bash
npm run validate:extension
```

## 本地安装

- Chrome：打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，指向 `dist/extensions/chrome`。
- Edge：打开 `edge://extensions`，启用开发人员模式，选择“加载解压缩的扩展”，指向 `dist/extensions/edge`。
- 360：在最新版 360 安全浏览器极速模式或 360 极速浏览器 X 中打开扩展管理，启用开发者模式并加载 `dist/extensions/360`。
- QQ：在最新版 Windows QQ 浏览器的扩展管理中启用开发者模式并加载 `dist/extensions/qq`。

Chrome、Edge 按商店发布目标维护；360、QQ 仅作为最新版 Windows Chromium 内核的兼容安装包，不生成 CRX，不承诺应用中心上架，也不支持 360 兼容模式或 Manifest V2。

扩展版禁用 Vercel Analytics 和远程 favicon，请勿在扩展入口恢复远程脚本、远程模块或运行时图标服务。

商店文案、权限说明、审核步骤和隐私政策位于 `extension/store/`。

## 自动发布

GitHub Actions 支持两种运行方式：

- 在 Actions 页面手动运行 `Release browser extensions`：执行测试、构建和校验，并将四个 ZIP 与 `SHA256SUMS.txt` 保存为 14 天的工作流产物，不创建 Release。
- 推送格式为 `vX.Y.Z` 的 Tag：执行相同检查，通过后自动创建公开 GitHub Release。

发布版本以 `package.json` 为唯一来源，并且必须与 `package-lock.json` 和 Tag 一致。Tag 对应的提交必须位于 `main`。发布新版本的示例：

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "发布新版本"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

请将示例中的 `vX.Y.Z` 替换为实际版本，例如 `v0.1.1`。检查失败时不会创建或覆盖 Release；修复后重新运行失败的工作流，或在尚未公开发布时使用新的正确版本发布。
