# Bulbul 动效设计语言（方案 A · Token Lock）

> 本文档是 DESIGN.md 的姊妹篇。DESIGN.md 定义视觉语言（色彩 / 字体 / 阴影 / 组件形态），本文档定义**动效语言**——方案 A 的完整细化：视觉零改动，只把动效收编进令牌矩阵。
>
> 效力与 DESIGN.md 同级：矩阵之外的时长、曲线、编排一律视为违规，code review 直接打回。

---

## 0. 现状审计结论（本规范要消灭的问题）

| 问题 | 证据 |
|---|---|
| 三套动效系统并行 | CSS transition（令牌化）+ `motion` JS 库（8 组件）+ Canvas 2D 手写补间（`easeOutQuart`） |
| 时长 11 种 | 80 / 120 / 150 / 180 / 200 / 240 / 250 / 260 / 280 / 300 / 500ms |
| 缓动 7 条 | 令牌 4 条 + 野生的 `easeOutQuart`、`cubic-bezier(0.16,1,0.3,1)`（Loupe）、`'easeOut'`（ToastContainer） |
| 名实不符 | `EASE_OUT_QUART = [0.25,1,0.5,1]` 在两个对话框各抄一份，值其实是 `--ease-swift` |
| 编排野生 | About 对话框 spring(d30/s400)+stagger 0.06、两个抽屉面板 spring(d30/s300)，参数各自发明 |

CSS 侧基本守规矩（Button/Badge/Slider/Toast 等大量引用 `--transition-*`），**失控集中在 JS/motion 侧与个别硬编码**。这正是方案 A 的收编对象。

---

## 1. 五条具名规则（Named Rules）

**The 3×3 Rule（三三矩阵）。** 全库只允许 3 档时长（80/120/200/300ms 中的后三档为状态与入场档，80ms 仅供按压）与 3+1 条曲线（standard / out-quint / swift + 按压专用 bounce）。任何第 4 档时长、第 5 条曲线都是违规。

**The CSS-First Rule（CSS 优先）。** 能用 CSS transition 表达的动效一律走 CSS 并引用令牌。`motion` 库的唯一合法用途是 `AnimatePresence` 的**卸载动画**（exit）——这是 CSS 做不到的唯一场景。进场动画能 CSS 就 CSS。

**The Canvas Exemption Rule（画布豁免）。** Canvas 2D 渲染循环内的补间（惯性平移、缩放、悬停渐变）无法走 CSS，允许手写补间，但曲线只允许 `easeOutQuart`（`utils/easing.ts` 单一来源），时长只允许取矩阵档位。

**The Quiet Exit Rule（安静出场）。** 出场永远比入场快、比入场简单：入场可以带位移，出场只做 fade 或原路返回，时长 ≤ 入场。元素消失不该被注意到。

**The No-Choreography Rule（禁止编排）。** 禁止 stagger、禁止逐项入场、禁止 spring 参数。列表、对话框内容、胶片条一律整体入场。唯一例外：WelcomePage 一次性首屏编排（见 §4.6）。

---

## 2. 令牌矩阵

### 2.1 时长刻度

| 令牌 | 值 | 用途 |
|---|---|---|
| `--duration-press` | 80ms | 仅按压反馈（active press） |
| `--duration-fast` | 120ms | 一切状态反馈：hover / focus / 变色 / 选中 / 微位移 |
| `--duration-normal` | 200ms | 入场与揭示：对话框、Toast、Popover、条板滑入 |
| `--duration-slow` | 300ms | 面板级进出场：抽屉、设置面板；进度条推进 |

### 2.2 缓动曲线

| 令牌 | 值 | 用途 |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认状态过渡 |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | 入场与揭示（唯一入场曲线） |
| `--ease-swift` | `cubic-bezier(0.25, 1, 0.5, 1)` | 微交互位移：缩略图、胶片条、指示条 |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **仅** 80ms 按压反馈，其他场景禁用 |

### 2.3 位移刻度

入场位移只允许两档，禁止自由发挥：

| 令牌 | 值 | 用途 |
|---|---|---|
| `--motion-distance-sm` | 4px | 小件入场：Popover、对话框、Toast |
| `--motion-distance-md` | 8px | 条板入场：TopNavBar（y:-8）、BottomFilmstrip（y:+8） |

抽屉面板位移 = 自身宽度（320px），是布局值不是动效值，不设令牌。

### 2.4 按压缩放规范值

| 组件 | scale | 时长/曲线 |
|---|---|---|
| 按钮 | 0.98 | 80ms bounce |
| 工具按钮 | 0.92 | 80ms bounce |
| 胶片条项 | 0.96 | 80ms bounce |

### 2.5 组合令牌（追加进 variables.css）

```css
/* 时长刻度（与曲线解耦，供 JS/motion 侧桥接） */
--duration-press: 80ms;
--duration-fast: 120ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* 语义组合 */
--transition-press: var(--duration-press) var(--ease-bounce);
--transition-swift: var(--duration-fast) var(--ease-swift);
--transition-enter: var(--duration-normal) var(--ease-out-quint);

/* 入场位移刻度 */
--motion-distance-sm: 4px;
--motion-distance-md: 8px;
```

> 既有 `--transition-fast/normal/slow` 保留不动（向后兼容），语义映射：fast = 120 standard、normal = 200 standard、slow = 300 standard。

### 2.6 JS 侧桥接（motion 唯一合法取值来源）

`motion` 组件里的 `transition={{...}}` 禁止写字面量，统一引用桥接常量：

```ts
// src/utils/motionTokens.ts —— 与 variables.css 同步的唯一事实来源
export const DURATION = { press: 0.08, fast: 0.12, normal: 0.2, slow: 0.3 } as const;
export const EASE = {
  standard: [0.4, 0, 0.2, 1],
  outQuint: [0.22, 1, 0.36, 1],
  swift: [0.25, 1, 0.5, 1],
} as const;
// 用法：transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
```

---

## 3. 三系统边界

| 系统 | 管辖范围 | 允许 | 禁止 |
|---|---|---|---|
| **CSS transition** | 一切状态反馈 + 能 CSS 表达的入场 | 引用矩阵令牌 | 字面量时长/曲线 |
| **motion (JS)** | 仅 `AnimatePresence` 卸载动画 | 引用 `motionTokens.ts` | 字面量、spring、stagger、layout 动画 |
| **Canvas 手写补间** | 渲染循环内：惯性、缩放、悬停渐变 | `utils/easing.ts` 的 `easeOutQuart` + 矩阵档位时长 | 另造曲线函数 |

`utils/easing.ts` 保留为 Canvas 唯一曲线来源；`easeOutQuart` 在 Canvas 语境正名为「画布标准减速曲线」，与 `--ease-out-quint` 同属减速族，手感等价。

---

## 4. 逐组件规范（全量）

图例：✅ 已合规 · 🔧 改参数 · ❌ 删/重写

### 4.1 基础控件

| 组件 | 交互 | 目标规范 | 现状 | 判定 |
|---|---|---|---|---|
| Button | hover/focus 变色 | 120ms standard | `var(--transition-fast)` | ✅ |
| Button | 按压 | scale(.98) 80ms bounce | 一致 | ✅ |
| Badge | 变色 | 120ms standard | 一致 | ✅ |
| Slider | track/thumb hover、拖拽阴影 | 120ms standard | 一致 | ✅ |
| Toggle（设置行） | 轨道变色 +  knob 位移 | 200ms standard | `var(--transition-normal)` | ✅ |

### 4.2 画布区

| 组件 | 交互 | 目标规范 | 现状 | 判定 |
|---|---|---|---|---|
| InfiniteCanvas | 惯性平移/缩放补间 | easeOutQuart + 矩阵档位 | easeOutQuart | ✅（豁免区） |
| CanvasImageItem | 悬停高亮渐变 | 120ms easeOutQuart | 150ms easeOutQuart | 🔧 150→120 |
| Loupe | 出现/消失 | 120ms standard（opacity）+ 200ms out-quint（transform） | 150ms `ease` + 200ms `cubic-bezier(0.16,1,0.3,1)` | ❌ 两条野生曲线全换 |
| ContextMenu | 菜单入场 | 200ms out-quint，opacity + scale(.98→1)，原点为触发点 | 无入场动画 | 🔧 补 |
| ContextMenu | 项 hover | 120ms standard | 一致 | ✅ |
| Scrollbar | 显隐/拖拽变色 | 120ms standard | 一致 | ✅ |
| loupe-hint / spin（global.css） | 功能性循环 | 保留，不受矩阵约束 | — | ✅ |

### 4.3 面板区

| 组件 | 交互 | 目标规范 | 现状 | 判定 |
|---|---|---|---|---|
| TopNavBar | 面板入场 | 200ms out-quint，y:-8→0 + fade | 250ms `[0.4,0,0.2,1]` y:-10 | 🔧 时长/位移归档 |
| TopNavBar | 图标切换（AnimatePresence） | 120ms standard，scale(.9) 可保留 | 150ms 字面量 | 🔧 |
| TopNavBar | 省份 Popover 进出 | 200ms out-quint，y:-4→0；exit 120ms fade | 150ms 字面量 | 🔧 |
| TopNavBar | 进度条宽度推进 | 300ms standard | `var(--transition-slow)` | ✅ |
| BottomFilmstrip | 面板入场 | 200ms out-quint，y:+8→0 + fade | 250ms y:+20 | 🔧 |
| FilmstripItem | hover/选中态 | 120ms swift | 200ms swift（变色）+ 120 swift（位移）| 🔧 统一 120 |
| FilmstripItem | 指示条滑入 | 200ms swift（indicatorSlideIn） | 260ms | 🔧 260→200 |
| FilmstripItem | 按压 | scale(.96) 80ms bounce | 一致 | ✅ |
| FilmstripItem | 缩略图 filter | 120ms swift | 150ms | 🔧 |
| SettingsPanel | 抽屉进出 | 300ms out-quint，x:320；overlay 200ms fade | spring d30/s300 | ❌ spring→out-quint |
| SpeciesDashboard | 抽屉进出 | 同上 | spring d30/s300 + 280ms 字面量 | ❌ |
| SpeciesDashboard | 进度条宽度 | 300ms standard | `var(--transition-slow)` | ✅ |

### 4.4 反馈与对话框

| 组件 | 交互 | 目标规范 | 现状 | 判定 |
|---|---|---|---|---|
| Toast | 进场 | 200ms out-quint，y:-4→0 + fade | 200ms `'easeOut'` 字符串 | 🔧 |
| Toast | 出场/重排（popLayout） | 120ms standard fade | popLayout 0.2 | 🔧 |
| Toast | hover 阴影升级、暂停计时 | 200ms standard / 保留 | `var(--transition-normal)` | ✅ |
| AboutDialog | 卡片进场 | 200ms out-quint，scale(.96→1) + y:4→0 | 250ms `[0.25,1,0.5,1]` + spring d30/s400 + **stagger 0.06** | ❌ 删 spring 与 stagger，内容整体入场 |
| AboutDialog | overlay | 200ms fade | 一致 | ✅ |
| AboutDialog | 链接 hover | 120ms standard；图标 200ms swift | `0.2s`（秒单位混用）| 🔧 单位统一 |
| ProgressDialog | 卡片进出 | 200ms out-quint，exit 120ms fade | 200/240ms `EASE_OUT_QUART` | 🔧 归档 |
| ProgressDialog | 阶段文本切换 | 180ms→120ms standard fade | 180ms | 🔧 |
| ExportProgressDialog | 同 ProgressDialog | 同上 | 同左（重复定义的 `EASE_OUT_QUART`） | 🔧 |

### 4.5 页面级

| 页面 | 交互 | 目标规范 | 现状 | 判定 |
|---|---|---|---|---|
| WelcomePage | 首屏编排（logoEnter/btnEnter 等 5 个 keyframes） | 全部收敛到 300ms out-quint，整体错落取消 | 500/600ms out-quint | 🔧 时长归档，曲线不变 |
| WelcomePage | dragPulse / errorEnter | 功能反馈保留；errorEnter 120ms standard | dragPulse 循环保留 | ✅/🔧 |
| MainPage | 无独立动效（经组件组合） | — | — | ✅ |

### 4.6 WelcomePage 豁免条款

WelcomePage 是用户见到的第一个画面，允许保留 logo/标题/按钮的**依次入场**（全库唯一 stagger 例外），但约束：项数 ≤ 3、间隔 ≤ 80ms、单项 300ms out-quint。这是一次性首屏，不是日常交互。

---

## 5. 编排规范

1. **进出场层级**：overlay（fade 200）与内容（位移入场 200）同时开始，不串行等待。
2. **快速连击**：300ms 内连续触发的同类动画跳过中间态直接到终态（BottomFilmstrip 已有此逻辑，推广为通则）。
3. **路由/页面切换**：无转场动画。桌面工具instant 切换，不做 App 式页面滑动。
4. **数字滚动**：禁止计数动画；tabular-nums 即时跳变。
5. **禁用清单**（写进 DESIGN.md Don'ts）：spring 参数、stagger（除 §4.6）、layout 动画、旋转入场、视差滚动、计数滚动。

---

## 6. 可访问性

- `prefers-reduced-motion`：一刀切——禁用全部 transition/animation（含 Canvas 补间直接到终态），仅保留 opacity 即时切换。global.css 已有媒体查询骨架，需确认覆盖 `*` 选择器。
- 按压反馈属于动效，reduced-motion 下同样移除（改为即时变色）。
- 焦点环出现不做动画（即时可见性优先）。

---

## 7. 迁移映射（文件级落地清单）

| 文件 | 改动 |
|---|---|
| `src/utils/motionTokens.ts` | 新建：JS 侧桥接常量（§2.6） |
| `src/styles/variables.css` | 追加 §2.5 令牌块（纯增量） |
| `src/components/dialogs/ProgressDialog.tsx` | 删本地 `EASE_OUT_QUART`，引用桥接；0.18/0.2/0.24 → DURATION.fast/normal |
| `src/components/dialogs/ExportProgressDialog.tsx` | 同上（消除重复定义） |
| `src/components/dialogs/AboutDialog.tsx` | 删 spring(d30/s400) 与 stagger variants；卡片 200ms out-quint；0.15→fast |
| `src/components/feedback/ToastContainer.tsx` | `'easeOut'` → `EASE.outQuint`；0.2 → DURATION.normal |
| `src/components/panels/TopNavBar.tsx` | 0.25/0.15 字面量 → 桥接常量 |
| `src/components/panels/BottomFilmstrip.tsx` | 0.25 → DURATION.normal；y:20→8 |
| `src/components/panels/SettingsPanel.tsx` | spring → 300ms out-quint；0.2 → normal |
| `src/components/panels/SpeciesDashboard.tsx` | 同上；0.28 → slow |
| `src/components/canvas/Loupe.module.css` + `Loupe.tsx` | 野生曲线 → 令牌；150→120 |
| `src/components/panels/FilmstripItem.module.css` | 硬编码 150/200/260ms → 令牌 |
| `src/components/canvas/CanvasImageItem.ts` | 补间 150ms → 120ms |
| `src/components/dialogs/AboutDialog.module.css` | `0.2s` → `var(--transition-normal)`（单位统一） |
| `src/windows/WelcomePage.module.css` | 500/600ms → 300ms |
| `DESIGN.md` | Don'ts 追加 §5 禁用清单（一句引用本文档） |

预估改动 16 个文件，无视觉像素变化，无 API 变化，测试快照不受影响（动画参数非断言对象）。

---

## 8. Code Review 检查表

新代码合入前逐项核对：

- [ ] 时长取值 ∈ {80, 120, 200, 300}ms（JS 侧 {0.08, 0.12, 0.2, 0.3}）
- [ ] 曲线引用令牌或 `EASE` 常量，无字面量 cubic-bezier
- [ ] 无 spring、无 stagger（WelcomePage 首屏除外）
- [ ] 入场位移 ∈ {4px, 8px}
- [ ] bounce 仅出现在 `:active` 按压
- [ ] motion 仅用于 AnimatePresence exit
- [ ] reduced-motion 下功能完整
