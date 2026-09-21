# Matter.js Wrecking Ball：改造成 Edith 新模板需要的知识

核查日期：2026-09-16。本文是研究与设计建议，不是新模板的已实现功能或已确认需求。

## 证据与版本边界

- 已用 Playwright + 本机 Chrome 的无头模式打开官方 Demo，实际拖动摆锤并松手，观察摆动与方块倒塌；所选示例确认为 `wreckingBall`，本次初始打开无 page error。
- 已读取 Demo 暴露的实例和实际部署的初始化函数，并下载其工具栏指向的 [官方示例源码][EX]；核对了下表对应的场景参数。
- API 对照 **Matter.js 0.20.0**，本地安装包实际也是 0.20.0。线上 `window.Matter.version` 返回 `"*"`，因此不能声称线上构建与本地发布版本相同。
- 网页检索接口多次返回空白；本次可追溯证据来自真实浏览器、官方源文件直接请求及本地实装包源码，不引用未取得的网页搜索结果。
- 未测真实手机、Safari、长期功耗或设备发热；也未实现、构建或验收新模板。

## 一、这个效果实际在做什么

核心过程：**重力驱动摆锤 → 距离约束限制它围绕锚点运动 → 重球撞击独立方块 → 接触、摩擦与旋转共同形成倒塌。**

| 构成 | 已核对的示例事实 | 改造时的意义 |
| --- | --- | --- |
| 世界与显示 | 800 × 600 逻辑场景，调用 Engine、Runner 和 Canvas Render | 不要把示例固定尺寸直接等同于响应式页面尺寸 |
| 方块墙 | 5 列 × 10 行，共 50 个 40 × 40 的矩形 | 可以把每个方块映射为站点；不是先建整墙再切碎 |
| 场景边界 | 四个静态矩形围住场景 | 可防止站点丢到屏幕外，但要适配窗口尺寸 |
| 摆锤 | 圆心初始为 (100,400)，半径 50，density=0.04，frictionAir=0.005 | 质量和低空气阻力有助于产生明显撞击；密度比不等于质量比 |
| 吊点 | 世界坐标 (300,100) 与球连接 | 决定摆动位置和可扫过的区域 |
| 约束 | 示例没有显式填 length、stiffness；本次运行值约 360.56、1 | 长度来自两端初始距离；默认刚性距离约束，不是真实柔软绳索 |
| 拖动 | 另建 MouseConstraint，stiffness=0.2 | 这是鼠标拖动约束的刚度，不是吊绳约束的刚度 |
| 画面 | 本次默认是线框，显示角度指示线 | 它证明运动机制，不代表导航模板的最终视觉品质 |

来源：[官方示例][EX]、[Constraint 源码][C]与现场实例。注意：`Composite` 是分组容器，不会把 50 个方块粘成一个不可分离的物体。这里没有材质断裂、碎片生成、真实绳身碰撞，也没有站点导航功能。

## 二、需要掌握的技术知识

不必先学习 Three.js、WebGL、复杂流体或自己编写碰撞求解器。应先能解释一个方块为何落下、一个球为何绕锚点摆动，再学习交互与业务边界。

| 用户需求问题 | 需要的知识 | 常见陷阱 | 官方 URL |
| --- | --- | --- | --- |
| 绳子多长、要不要有弹性？ | **事实**：`length` 是目标静止长度，未传则取初始锚点距离；`stiffness=1` 很硬，较低值呈弹簧效果。 | **Constraint 是两点距离约束，不是绳子软体**，没有绳身碰撞或自然松弛；创建时 `stiffness:0` 会被默认值覆盖。 | [API][Cdoc]、[源码][C] |
| 松手后怎样自然停摆？ | **事实**：`damping` 默认 0，按约束轴向相对速度抑制振荡，**刚度很低时才明显**；`frictionAir` 默认 0.01，衰减运动速度。 | 不能当作摆锤角向停止的万能阀。**建议**：先调空气阻力，再独立调整绳子弹性。 | [Constraint][C]、[Body][B] |
| 怎样体现重锤撞轻块？ | **事实**：`mass = density × area`；用 `Body.setMass`／`setDensity` 修改，会联动惯量等属性。 | 同密度不同尺寸并非同质量；直接赋值 `body.mass` 会漏更新关联量。**建议**：明确锤块质量比，再验证手感。 | [Body][B] |
| 碰撞后弹多少、滑多远？ | **事实**：`restitution` 管回弹，碰撞对取两者最大值；接触 `friction` 取最小值；`frictionAir` 管非接触减速。 | 只把一侧回弹设为 0 不保证不弹；增大地面摩擦不一定能弥补低摩擦块。 | [Body API][Bdoc]、[Pair][P] |
| 60／120Hz 屏幕速度一致吗？ | **事实**：Runner 使用固定 `delta`，默认 `1000/60` 毫秒；每个显示帧可执行零次、一次或多次物理更新，并受预算限制。 | 不是“一帧一步”；旧 `isFixed` 已冗余。**建议**：只保留一个物理推进入口，不叠加手动 `Engine.update`。 | [Runner][R] |
| 静止后能否不耗帧？ | **事实**：`enableSleeping` 默认 false，可降低部分物理计算，但有精度权衡。 | **sleep 不等于停止所有帧循环**；连 `runner.enabled=false` 也仍排队下一帧。**建议**：需要停帧时分别停止 Runner、Render 及自建循环，并设计恢复。 | [Engine API][Edoc]、[Runner][R]、[Render][V] |
| 缩放后怎样准确拖动、只拖锤？ | **事实**：Mouse 将元素坐标经尺寸／像素比换算，再应用 `scale`、`offset`；MouseConstraint 用 `collisionFilter` 筛选可拖刚体。 | **建议**：绑定实际画布，共用 Mouse，视口变化同步坐标；不要重复乘 DPR，也别默认导航块均可拖。 | [Mouse][M]、[MouseConstraint][MC] |
| 手机拖动会影响滚动吗？ | **事实**：取 `changedTouches[0]`；触摸和滚轮处理会 `preventDefault`；监听绑定在元素上。 | 不等于多指手势；源码未监听 `touchcancel`。**建议**：限定交互区域，补取消、失焦、画布外松手，并区分拖动与点击。 | [Mouse][M] |
| 高清屏为什么模糊或抓不准？ | **事实**：`pixelRatio` 默认 1；`Render.setPixelRatio(..., 'auto')` 调整画布像素尺寸，保持逻辑 CSS 尺寸。 | Mouse 创建时用 `parseInt` 读取比率，之后 Render 改比率不自动同步它。**建议**：显式同步 `mouse.pixelRatio`，测试小数 DPR。 | [Render][V]、[Mouse][M] |
| 切换模板怎样清理？ | **建议**：独占实例停止 Runner／Render；解除 Matter 事件及 Mouse 的 7 个 DOM 监听；`Composite.clear(world,false,true)`、`Engine.clear`，移除画布并释放纹理引用。 | **事实**：`Render.stop` 仅取消帧；`Engine.clear` 仅清碰撞缓存；`Mouse.clearSourceEvents` 仅清暂存事件，不解绑。共享实例不得全量清理；MouseConstraint 另注册了引擎 `beforeUpdate`。 | [Render][V]、[Engine][E]、[Mouse][M]、[MC][MC]、[Composite][CO]、[Events][EV] |
| 撞散是否会删除或重排站点？ | **事实**：引擎更新物理状态、派发碰撞事件，不内置导航数据操作；应用回调仍可写数据。 | **接入建议：碰撞不修改业务数据**，仅改临时物理状态；不得据此声称 Edith 当前实现已满足，需主 agent 核查回写链路。 | [Engine][E] |


## 三、当前 Edith 已有的基础与不能直接照抄的地方

以下是当前工作树的源码事实，不沿用历史测试结论：

1. **已经接入 Matter.js**，已有 `matter` 注册项，入口为 [MatterTemplate.tsx](../src/templates/matter/MatterTemplate.tsx)。当前是随机矩形／多边形图标落下、碰撞与堆积，没有摆锤和规则方块墙。
2. **已经分离 Canvas 与 HTML 语义**：Canvas `aria-hidden`；真正的站点使用 HTML 链接与 `SiteIcon`，在 `afterUpdate` 中同步位置、角度。建议新模板继续这个分工，不把链接全部画进 Canvas。
3. **当前拖动不是摆锤拖动**：`moveActiveDrag` 直接 `Body.setPosition` 并清零线速度、角速度。它是已有图标交互方案，不能不经验证就照搬成带绳摆锤；摆锤宜先验证“吊点约束 + 临时拖动约束”的组合，避免硬设位置与绳长约束打架。
4. **业务仍归公共层**：[types.ts](../src/templates/types.ts) 提供 modules、frequentSites、actions、interactionBlocked、revealSite；[App.tsx](../src/App.tsx) 负责配置与操作。碰撞、散落、复位只影响模板运行态；分类移动仍只能走 `actions.moveSite`，不能以球碰到哪个方块或方块落到哪里自动回写分类。
5. **切换保护有特殊风险**：[config.ts](../src/templates/config.ts) 在 dragging 或 settling 为真时拒绝切换。建议摆锤松手后的常规自由运动不一直上报 settling；只对有限的复位／过渡阶段使用它，并保证取消与超时出口。否则可能因等待“完全静止”而长期不能换模板。
6. **节能和减少动态不能直接继承为已完成**：当前 Engine 开启 sleeping，但 Render 与 Runner 都持续运行；当前 reduced-motion CSS 只调整 touch-action，并未关闭物理运动。新模板需要独立设计、测试真正的静态降级和停帧恢复。
7. **内容更新策略要先确定**：当前物理初始化 Effect 依赖 sites，站点集合变化会重建世界。新模板需决定编辑后的整体重建是否可接受，还是按稳定 site.id 增删对应 body；不要把这个体验选择藏在 React 重渲染里。

接入建议：新建独立模板目录与入口，通过 [registry.ts](../src/templates/registry.ts) 显式动态加载，保留旧 Matter 模板；不直接导入旧模板私有实现。共享边界以 [TEMPLATE_INTEGRATION.md](TEMPLATE_INTEGRATION.md) 和当前代码为准。

## 四、建议的产品方向：摆锤站点墙（未确认）

把“随机散落图标”改成“有秩序的站点墙，可由用户打散，并可恢复”。区别应是完整的浏览与玩耍流程，而非只在旧模板上挂一颗球。

- **分类**：建议映射为有标题、有固定颜色的方块组，或一次只展示一个分类。两者是待选择的布局方向，不是都要实现。
- **站点**：一个刚体对应一个稳定 site.id；名称和点击目标应可辨认，碰撞之后仍然可以访问。
- **摆锤**：建议作为独立玩耍控件，默认只允许拖球；是否也允许拖站点另行确认，以减少点击与拖动竞争。
- **失序后恢复**：建议提供“复位排列”与始终可用的普通列表／常用入口，不让找到站点依赖物理操作技巧。
- **编辑模式**：建议冻结或切回整齐布局，沿用公共编辑操作；摆锤碰撞不能表示删除、重命名或跨分类移动。
- **首次进入**：自动撞一次还是等待用户触发，应先决定。默认持续自动摆动不应被视为必需。
- **视觉**：建议让运动来自引擎，圆角、配色、阴影、文字来自渲染层；先保证标签与命中区域一致，再加装饰。精致度需要浏览器观察，不能由引入物理库推断。

状态建议：`整齐浏览 → 拖球 → 松手摆动／撞散 → 复位 → 整齐浏览`。编辑与减少动态是独立的稳定分支。**球在运动 ≠ 用户仍在拖动 ≠ 页面处于业务编辑状态。**

## 五、最小学习与验证顺序

1. **理解一个摆锤**：只做球、锚点、约束、地板；能调绳长、初始角度和空气阻力，解释为什么会撞到或错过目标。
2. **理解一次碰撞**：加少量方块，控制球与块的质量关系、回弹、接触摩擦，验证松手后的手感；不要一开始加入所有站点和滤镜。
3. **理解导航交互**：把一个方块接成真实链接，验证点击确实打开页面且仅记一次访问；拖动／取消不能打开链接。再扩成站点墙。
4. **接入模板协议**：公共编辑、常用入口、定位、交互阻塞、动态加载、卸载清理与内容更新。
5. **最后做视觉与性能**：测桌面和窄屏、缩放和 DPR；对比空闲与碰撞的帧耗时，验证停帧后的点击／拖动可唤醒，并测试减少动态。

验收重点：普通点击／快速连续点击；pointercancel／失焦／离开浏览器；碰撞不改配置；复位只改临时位置；抽屉开启不穿透；摆动中能按约定切换且旧世界彻底停止；resize 后边界、吊点、标签和命中坐标一致；空分类与站点量增长；键盘和减少动态可用。

## 六、本次取证文件

临时证据目录：`/tmp/edith-wreckingball-research/`。

- `official-demo.png`：官方场景截图。
- `drag-ball.png`、`after-impact.png`：真实鼠标拖动与释放后的截图。
- `runtime-initial.json`、`drag-observations.json`：运行时参数与一次拖动观测，不能当作确定性性能基准。
- `deployed-example-function.js`：当前页面暴露的初始化函数。
- `wreckingBall.js`：工具栏 sourceLink 指向的官方源文件快照。

本次只新增研究文档，未修改应用代码；不代表新模板已经开发、测试或发布。没有提交或推送。

## 官方参考

[EX]: https://github.com/liabru/matter-js/blob/master/examples/wreckingBall.js
[Cdoc]: https://brm.io/matter-js/docs/classes/Constraint.html
[Bdoc]: https://brm.io/matter-js/docs/classes/Body.html
[Edoc]: https://brm.io/matter-js/docs/classes/Engine.html
[C]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/constraint/Constraint.js
[B]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/body/Body.js
[P]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/collision/Pair.js
[R]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/core/Runner.js
[V]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/render/Render.js
[M]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/core/Mouse.js
[MC]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/constraint/MouseConstraint.js
[E]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/core/Engine.js
[CO]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/body/Composite.js
[EV]: https://raw.githubusercontent.com/liabru/matter-js/0.20.0/src/core/Events.js
