# 配置、存储与备份

## 配置模型

类型定义见 `src/types.ts`，默认内容见 `src/data/defaultConfig.ts`。

| 类型 | 字段 |
| --- | --- |
| `Site` | `id`、`name`、`url`、`description`，可选 `shortcut` |
| `Module` | `id`、`title`、`description`、`accent`、`sites` |
| `NavigationConfig` | `templateId`、`modules`、`accent`，可选 `iconPositionPersistence` |
| `IconPosition` | `x`、`y` 为 0–1 归一化坐标，`angle` 为有限数值旋转角（Matter 使用弧度） |

主题色和描述配置入口已移除，页面统一使用默认主题配色。旧全局 `accent` 和站点/分类 `description` 字段保留用于兼容存储及备份，编辑已有条目时保留这些字段；新增条目的描述为空字符串，新分类使用默认强调色。描述不再用于站点悬停提示或无障碍名称。分类强调色仍可单独编辑。

兼容字段全局 `accent` 仅接受 `mint` / `violet` / `orange`；分类 `accent` 为字符串。`templateId` 当前为 `bubble` / `matter` / `beijing` / `plain`。`shortcut` 是可选数据字段，不代表已有站点快捷键绑定。

位置配置结构：

```ts
iconPositionPersistence?: {
  matter?: { enabled: boolean; positions: Record<string, IconPosition> }
  beijing?: { enabled: boolean; positions: Record<string, IconPosition> }
}
```

两套位置按站点 ID 保存且互不覆盖。未配置时默认关闭；保存时过滤不存在的站点 ID，不保存速度或物理世界快照。

## 存储键

`src/platform/storage.ts` 统一管理以下键，值在底层均为字符串：

| 键 | 内容 |
| --- | --- |
| `edith-navigation-config-v3` | 导航配置 JSON |
| `edith-navigation-search-engine-v1` | `google` / `perplexity` / `baidu` |
| `edith-navigation-usage-v1` | 站点 ID → 访问次数的 JSON 对象 |
| `edith-navigation-onboarding-completed-v1` | 完成时保存 `'1'`；应用启动按非空值判断完成 |

网页使用当前 origin 的 `localStorage`。扩展在检测到 `chrome.runtime.id` 和 `chrome.storage.local` 后使用扩展存储；启动时异步读取到内存缓存，以保持组件读取接口同步。没有实现自动从网页迁移到扩展，也没有使用 `storage.sync`。

网页通过 `storage` 事件接收其他标签页的对应键变更；扩展通过 `chrome.storage.onChanged` 更新缓存与订阅者。这里是本地跨标签页更新，不是跨设备同步。

## 加载与兼容

`normalizeTemplateConfig` 检查基本数据形状。缺失或未知模板 ID 回退默认 `bubble`，有效的用户分类和站点继续保留；整体结构不合法或 JSON 无法解析时使用默认配置。

可选位置配置仅在原字段存在时正规化；剔除非有限数值、越界坐标等无效位置。结构检查不包含站点 ID 全局唯一性或完整 URL 安全校验，不应当把它描述为严格数据 schema 验证。

配置保存失败时 `usePersistentConfig` 给出提示，本次页面内状态仍保留。搜索引擎、访问计数和引导状态的保存错误采用静默容错。

## JSON 备份协议

`src/platform/backup.ts` 提供 `createBackup`、`parseBackup`、`importBackup`。

```json
{
  "format": "edith-backup",
  "version": 1,
  "exportedAt": "2026-10-20T00:00:00.000Z",
  "data": {
    "edith-navigation-search-engine-v1": "google",
    "edith-navigation-usage-v1": {},
    "edith-navigation-onboarding-completed-v1": true
  }
}
```

示例省略导航配置；真实导出会收集已存在的受管理键，配置/访问次数是 JSON 对象，引导状态为布尔值。`exportedAt` 是导出时间，当前解析器不验证该字段。

导入先验证格式版本和已知键内容：配置要求带字符串 `templateId`，搜索引擎必须在列表内，访问次数必须是非负有限数值，引导状态必须是布尔值。未知键不写入存储。

导入采用整体替换语义：备份缺失的受管理键会删除，引导值为 `false` 时也删除该键。写入失败会尝试恢复旧快照，但不是底层原子事务，恢复也可能失败。只有导入成功后 App 才刷新页面。

“恢复默认”仅调用 `resetContent`：保留当前 `templateId`，其余导航配置恢复默认；另外三个独立键不清除。

## 本机语言和图标服务偏好

`edith-navigation-preferences-v1` 保存 `{ language: 'auto' | 'zh-CN' | 'en', iconService: 'domestic' | 'google' }`，网页版使用 localStorage，插件使用 chrome.storage.local。首次默认值由浏览器语言决定：简体中文使用国内服务，其余使用 Google；已有手动选择不随界面语言变化。

该键独立于导航配置和 v1 JSON 备份。导入旧备份、恢复默认导航内容均保留本机偏好，不需要配置迁移。图片使用浏览器和服务端缓存，不存入导航配置或扩展存储。扩展初始化会预加载偏好，并订阅其他新标签页的修改。
