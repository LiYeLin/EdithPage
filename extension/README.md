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
