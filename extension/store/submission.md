# 商店提交资料

## 中文简介

Edith 是一个可配置的新标签页导航，提供分类站点、跟随浏览器默认设置的搜索、多套视觉模板和流畅交互；可在当前页面临时切换搜索引擎。所有配置只保存在本机，并可通过 JSON 在 Chrome、Edge 和网页版之间迁移。

## English summary

Edith is a configurable new-tab dashboard with categorized links, search using your browser’s default provider, visual templates, and polished interactions. You can temporarily select another search provider on the current page. Configuration stays on-device and can be moved between Chrome, Edge, and the web app through JSON backup files.

## 权限说明

- `storage`：保存用户配置、访问计数和引导状态，并兼容备份中的旧引擎偏好；临时引擎选择不写入存储。
- `search`：通过浏览器默认搜索引擎执行用户主动提交的查询，在新标签页打开结果；不修改浏览器搜索设置。
- 不申请主机权限、浏览历史、书签、标签页、后台运行或网页内容权限。

## 审核步骤

1. 安装扩展并打开新标签页，确认 Edith 替换默认新标签页。
2. 打开设置，添加站点或分类，关闭并重新打开新标签页确认配置保留。
3. 在“数据迁移”中导出 JSON，再导入该文件验证恢复流程。
4. 默认选中“浏览器默认”，提交查询后确认结果由浏览器设置的默认引擎提供；在浏览器设置中更换默认引擎后再次验证。
5. 临时选择其他引擎并搜索，刷新或重新打开扩展页，确认恢复“浏览器默认”；导入旧备份同样不能改变此默认行为。
6. 空查询不打开页面；API 不支持或调用失败时显示提示，不自动切换引擎。
7. 断开网络并打开新标签页，确认界面和本地图标仍可加载。

发布前仍需在商店后台补充：支持邮箱、隐私政策公开 URL、1280×800 或 640×400 截图，以及商店要求的宣传图。

## 国产浏览器兼容状态

- 360：仅提供最新版 360 安全浏览器极速模式、360 极速浏览器 X 的 MV3 兼容包。当前审核规则限制新标签页修改，未取得平台书面确认前不提交商店。
- QQ：仅提供最新版 Windows QQ 浏览器的 MV3 兼容包。当前没有可复现的公开开发者提交通道，不承诺商店发布。
- 两者均不生成 CRX、不内置 `update_url`、不维护 Manifest V2。
