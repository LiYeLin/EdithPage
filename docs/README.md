# Edith 文档索引

本套现状文档整理于 2026-10-20，依据本地 `main` 的 `70971d4` 及工作区已有扩展发布工作流；描述代码行为，不代表商店已上架或所有设备均已验收。

## 当前实现

| 文档 | 内容 |
| --- | --- |
| [功能与使用](USER_GUIDE.md) | 搜索、四套模板、编辑、撤销和备份 |
| [代码架构](ARCHITECTURE.md) | 公共状态、模板边界、物理和图标资源 |
| [配置、存储与备份](DATA_AND_STORAGE.md) | 数据结构、存储键、兼容规则、导入覆盖语义 |
| [开发、测试与构建](DEVELOPMENT.md) | 命令、测试层次、构建产物、发布流程 |
| [模板接入](TEMPLATE_INTEGRATION.md) | 新增模板协议、加载、样式和清理要求 |
| [扩展说明](../extension/README.md) | 四浏览器构建、安装和自动发布 |
| [北京地形素材](../public/terrain/README.md) | 素材坐标、碰撞轮廓和资源来源 |
| [图标素材](../public/site-icons/README.md) | 本地图标资源说明 |

## 专项与历史资料

| 文档 | 阅读边界 |
| --- | --- |
| [待排期问题](ISSUES.md) | 用户反馈、调整需求与验收标准，尚未实施 |
| [特效与动画](EFFECTS_AND_ANIMATION_SPEC.md) | 气泡水滴实现与历史方案；旧测试数量不代表当前数量 |
| [待讨论问题](OPEN_QUESTIONS.md) | 问题记录，未构成新增需求 |
| [原型说明](PROTOTYPE_NOTES.md) | 初期原型快照，当前功能以本套现状文档为准 |
| [Matter 摆锤研究](MATTER_WRECKING_BALL_RESEARCH.md) | 摆锤示例研究，当前物理图标模板不等于实现了摆锤玩法 |
| [跨浏览器研究](BROWSER_EXTENSION_RESEARCH_AND_ARCHITECTURE.md) | 历史调研，市场数据和商店规则不作为当前事实保证 |

修改功能时同步对应现状文档；历史讨论保留时间和上下文，避免把提案写成已实现能力。
