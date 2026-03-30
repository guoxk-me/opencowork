# OpenCowork 更新日志

| 版本   | 日期       | 状态   |
| ------ | ---------- | ------ |
| v0.5.0 | 2026-03-30 | 已发布 |
| v0.4.0 | 2026-03-30 | 已发布 |
| v0.3.0 | 2026-03-29 | 已发布 |
| v0.2.3 | 2026-03-29 | 已发布 |

---

## v0.5.0 (2026-03-30) - TaskHistory + Skill System + WhitelistConfigUI

### 版本目标

新增三大核心功能模块：TaskHistory、Skill System、WhitelistConfigUI

### 新增功能

#### TaskHistory - 任务历史系统

1. **SQLite 持久化存储**
   - 任务历史存储在 `history.db` 数据库
   - 支持断电重启后数据不丢失
   - 自动同步内存到 SQLite

2. **完整状态追踪**
   - pending → running → completed/failed/cancelled
   - 每个任务记录开始时间、结束时间、耗时
   - 执行步骤详情记录

3. **统计指标**
   - 总任务数、成功率、平均耗时
   - 按状态分类统计

#### Skill System - 技能系统

1. **SKILL.md 规范支持**
   - 完全兼容 Claude 官方技能定义格式
   - YAML frontmatter 解析 (使用 js-yaml)
   - 触发器配置 (keyword/pattern/intent)

2. **技能市场**
   - 安装、卸载、查看已安装技能
   - 技能目录管理 (`~/.opencowork/skills/`)

3. **安全执行**
   - 命令白名单限制
   - 路径验证防止目录遍历
   - Shell 注入保护

#### WhitelistConfigUI - 白名单配置

1. **可视化配置界面**
   - Tab 切换 (CLI/路径/网络/Agent)
   - 风险等级标注
   - 保存/重置功能

2. **配置类型**
   - CLI 命令白名单
   - 路径访问权限
   - 网络访问控制
   - Agent 工具限制

### 安全修复

| CVE ID | 严重程度 | 问题                    | 修复           |
| ------ | -------- | ----------------------- | -------------- |
| -      | 严重     | Skill 路径遍历漏洞      | 添加路径验证   |
| -      | 严重     | 危险命令 (cat) 在白名单 | 从允许列表移除 |
| -      | 高       | Shell 注入风险          | 默认关闭       |
| -      | 高       | SQLite 写入数据丢失     | 重试机制       |

### 代码质量

| 优先级    | 修复数量 | 示例               |
| --------- | -------- | ------------------ |
| P0 (严重) | 4        | 路径遍历、危险命令 |
| P1 (高)   | 7        | 竞态条件、统计不准 |
| P2 (中)   | 11       | 空 catch、格式验证 |

### 新增文件

| 文件                                               | 用途                        |
| -------------------------------------------------- | --------------------------- |
| `src/history/*.ts`                                 | TaskHistory 模块 (6个文件)  |
| `src/skills/*.ts`                                  | Skill System 模块 (4个文件) |
| `src/config/whitelistConfig*.ts`                   | 白名单配置模块              |
| `src/renderer/components/HistoryPanel.tsx`         | 历史面板组件                |
| `src/renderer/components/SkillPanel.tsx`           | 技能面板组件                |
| `src/renderer/components/WhitelistConfigPanel.tsx` | 白名单配置组件              |
| `src/renderer/stores/historyStore.ts`              | 前端状态管理                |

### 依赖更新

| 依赖           | 版本    | 说明        |
| -------------- | ------- | ----------- |
| better-sqlite3 | ^11.0.0 | SQLite 支持 |
| js-yaml        | ^4.1.0  | YAML 解析   |

---

## v0.4.0 (2026-03-30) - LangChain/LangGraph 重构

### 版本目标

全量采用 LangChain/LangGraph TypeScript 版本替换现有架构，实现标准化 Agent 执行流程

### 核心变更

| 模块     | v0.3 实现               | v0.4 LangGraph 实现        |
| -------- | ----------------------- | -------------------------- |
| 状态管理 | Map<string, TaskHandle> | StateSchema + Checkpointer |
| 任务执行 | PlanExecutor 线性执行   | StateGraph Nodes/Edges     |
| 规划器   | TaskPlanner LLM 调用    | Agent Node + Tools         |
| 恢复机制 | RecoveryEngine 手动     | 内置 Durable Execution     |
| 记忆     | ShortTermMemory 内存Map | Memory Store               |
| 验证     | Verifier 手动           | Graph State Validation     |
| 可观测   | console.log 手动        | LangSmith 集成             |

### 实施计划

| 阶段    | 周次       | 任务                                       |
| ------- | ---------- | ------------------------------------------ |
| Phase 1 | Week 1-2   | LangChain/LangGraph 引入，StateSchema 设计 |
| Phase 2 | Week 3-4   | StateGraph 重构，基础 Nodes 实现           |
| Phase 3 | Week 5-6   | Browser/CLI Tools 封装                     |
| Phase 4 | Week 7-8   | Checkpointer 持久化                        |
| Phase 5 | Week 9-10  | Memory Store 集成                          |
| Phase 6 | Week 11-12 | Vision Tool 封装                           |
| Phase 7 | Week 13-14 | LangSmith 集成                             |
| Phase 8 | Week 15-16 | 测试与优化                                 |

### 预期指标

| 指标       | v0.3   | v0.4 目标 |
| ---------- | ------ | --------- |
| 任务成功率 | 85-95% | 90-98%    |
| 代码复用   | -      | +40%      |
| 恢复能力   | 手动   | 内置      |
| 可观测性   | 手动   | LangSmith |

### 里程碑

- **Week 4**: 核心 Graph 可运行
- **Week 8**: 任务可持久化恢复
- **Week 12**: Vision Tool 完成
- **Week 16**: v0.4 发布

---

## v0.3.0 (2026-03-29) - 工业级Browser Agent架构

### 版本目标

实现工业级Browser Agent架构，目标任务成功率达到85-95%

### 新增功能

1. **UIGraph语义层** - 将DOM转换为语义化元素图谱，LLM只看到语义ID而非原始selector
2. **Observer观察者** - 页面观察者类，失败后捕获UIGraph
3. **Verifier验证层** - 每步执行后验证页面状态变化
4. **RecoveryEngine恢复引擎** - 独立的LLM驱动恢复决策系统
5. **ShortTermMemory短期记忆** - 记录成功/失败轨迹用于学习
6. **反爬虫机制文档** - 记录现有反爬虫实现和已知弱点

### 核心架构改进

```
Observe → Decide → Act → Verify → Recovery → Memory
         ↑                              ↓
         └──────── 失败后触发 ←────────┘
```

### 新增文件

| 文件                             | 用途                    |
| -------------------------------- | ----------------------- |
| `src/types/uiElement.ts`         | UI元素和UIGraph类型定义 |
| `src/types/verifier.ts`          | Verifier类型定义        |
| `src/browser/uiGraph.ts`         | UIGraph语义图构建器     |
| `src/browser/observer.ts`        | 页面观察者类            |
| `src/executor/verifier.ts`       | 验证层                  |
| `src/recovery/recoveryEngine.ts` | 独立恢复引擎            |
| `src/memory/shortTermMemory.ts`  | 短期记忆                |

### 预期指标

| 指标              | v0.2 | v0.3目标 |
| ----------------- | ---- | -------- |
| Task success rate | ~65% | 85-95%   |
| Click accuracy    | ~80% | >95%     |
| Step latency      | 2-5s | 1-3s     |
| 失败后恢复率      | ~50% | >80%     |

---

## v0.2.3 (2026-03-29)

### 新增功能

1. **元素滚动到视口** - 在 click 和 input 操作前添加 `scrollIntoViewIfNeeded()`，确保元素在可视区域再执行操作

2. **PressEnter 参数支持** - `browser:input` Action 支持 `pressEnter` 参数，输入完成后自动按 Enter 提交

### 修复问题

1. **评论区输入失败** - 修复元素在页面下方无法找到的问题，现在会先滚动到元素位置再输入

2. **Enter 键时机问题** - 输入后等待 100ms 再按 Enter，确保焦点稳定

3. **选择器解析问题** - 修复逗号分隔的选择器未正确拆分为数组的问题

4. **任务队列冲突** - 添加 `isTaskRunning()` 检查，防止多个任务并发执行

5. **选择器应用错误** - 修复 Replanner 将新选择器应用到所有节点的问题，改为只修改失败节点

6. **IPC 重复注册** - 修复 `ask:user:response` IPC 处理器重复注册导致崩溃

7. **页面结构增强** - 添加 `getPageStructure()` 方法，提取页面 DOM 结构及 30 个链接的 boundingBox 坐标

8. **登录弹窗检测** - 改为任务执行期间检测，而非启动时检测

### 优化改进

1. **预览刷新速度** - fps 24, quality 20, maxWidth 800，提升预览流畅度

2. **浏览器高度自适应** - 移除 maxHeight 限制，preview 区域自动填充

3. **LLM 推理模式** - 启用 Azure OpenAI 的 `reasoning_effort: 'medium'` 模式

4. **选择器生成优化** - TaskPlanner 系统提示词增强，强制 LLM 输出 CSS 选择器

5. **会话持久化** - SessionManager + sessionStore + SessionPanel，支持任务上下文记忆

### 依赖

- playwright-extra: ^4.3.6
- playwright-stealth: ^0.0.1
- zustand: ^4.5.7

---

## v0.2.2 (2026-03-28)

### 新增功能

1. **SessionPanel 组件** - UI 显示会话历史

2. **页面结构提取** - getPageStructure() 提取页面链接和容器信息

### 修复问题

1. **预览高度限制** - 移除 maxHeight 限制

2. **Enter 双重发送** - 移除 click 失败时的 Enter fallback

---

## v0.2.1 (2026-03-28)

### 修复问题

1. **预览速度慢** - 优化 ScreencastService fps 和 quality

2. **登录弹窗误判** - 优化检测逻辑

---

## v0.2.0 (2026-03-28)

### 新增功能

1. **ask:user 完整实现** - AskUserExecutor + IPC 完整流程
2. **Replanner 动态重规划** - LLM 决策重试策略，最多 3 次重试
3. **Selector 稳定性改进** - 多策略选择器 + fallbacks
4. **ScreencastService** - 实时截图预览（替代 BrowserView 方案）

---

## v0.1.0 (2026-03-27)

### 首次发布 (MVP)

- Electron + React + Vite 项目
- TaskPlanner 任务规划
- PlanExecutor 计划执行
- TaskEngine 任务引擎
- BrowserExecutor 浏览器自动化
- CLIExecutor 命令执行
- ChatUI / ControlBar / TakeoverModal 组件

---

_文档创建日期: 2026-03-29_
