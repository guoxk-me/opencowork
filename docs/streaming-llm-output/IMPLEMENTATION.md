# 流式 LLM 输出改造

## 概述

将项目中的 LLM 对话输出从**批量（batch）模式**改为**流式（streaming）模式**，使用户在任务执行过程中能实时看到 LLM 的思考文本逐字输出，而非等待完整响应后才一次性显示。

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/agents/mainAgent.ts` | 核心改动 | 启用 ChatOpenAI streaming + invoke → stream |
| `src/config/constants.ts` | 新增 IPC 通道 | task:streamToken / task:streamEnd |
| `src/renderer/stores/taskStore.ts` | 新增状态管理 | 流式消息的创建/追加/完成 |
| `src/renderer/App.tsx` | 新增事件监听 | 监听流式事件，驱动 UI 更新 |
| `src/renderer/components/ChatMessage.tsx` | UI 增强 | 流式消息显示闪烁光标 |
| `src/renderer/components/ChatInput.tsx` | 移除冗余 | 去掉提交时插入的占位 AI 消息 |
| `src/renderer/styles/index.css` | 样式新增 | 光标闪烁动画 |

共涉及 **7 个文件**，新增约 **129 行**，删除约 **16 行**。

---

## 各层改动详解

### 1. LLM 调用层 (`mainAgent.ts`)

**改动前**：`ChatOpenAI` 未开启 `streaming`（默认 `false`），Agent 通过 `this.agent.invoke()` 发起调用，阻塞等待完整结果返回后一次性处理。

**改动后**：

- **`streaming: true`**：ChatOpenAI 构造时开启流式模式（第 1323 行），底层 `/chat/completions` 请求会携带 `stream: true`，服务端以 SSE 方式逐 token 返回。

- **`invoke()` → `stream()`**：LangGraph 的 `CompiledStateGraph` 提供两种流式方法：
  - `stream()` — 返回 `IterableReadableStream`，通过 `streamMode` 控制粒度
  - `streamEvents()` — 返回更细粒度的 tracer 事件

  选择 `stream()` + `streamMode: "messages"`，因为这个模式直接产出每个消息块（`[message, metadata]` 元组），LLM token 以 `AIMessageChunk` 对象出现在流中。`streamEvents()` 会产生更多冗余事件（`on_chain_start`、`on_chat_model_start` 等），对 token 级流式场景过重。

- **Token 提取与推送**：遍历流中的每个 chunk，过滤出 `AIMessageChunk`（LLM 产出的 token 片段），处理 `content` 的两种格式（纯字符串 / 多模态数组），通过 `sendToRenderer('task:streamToken', ...)` 推送到渲染进程。

- **流结束处理**：流遍历结束后发送 `task:streamEnd` 通知 UI 完成，然后通过 `agent.getState()` 获取 checkpoint 中的最终聚合状态（含完整合并后的 `messages`），复用原有的 `extractSteps()` 和 `extractFinalMessage()` 逻辑。

- **超时保持**：原 `invoke()` 的 `Promise.race(timeoutPromise)` 模式保留，将整个流式 IIFE 包装后与超时竞争。

- **恢复流程不动**：`restoreFromState()` 仍使用 `invoke()`，原因：恢复场景下用户不需要实时观看，且 `invoke()` 的阻塞特性更简单可靠。

**关键设计决策 — 为什么需要 `getState()`**：`streamMode: "messages"` 流出的消息是**原始块**——LLM 的每个 token 都是一个 `AIMessageChunk`。但 `extractSteps()` 和 `extractFinalMessage()` 需要**聚合后的完整消息**（如含 `tool_calls` 的 `AIMessage`）。LangGraph 的 checkpoint 机制在每次状态更新时通过 `messagesReducer` 合并 chunks，因此 `getState().values.messages` 拿到的就是聚合后的最终消息列表，可直接复用现有提取逻辑。

### 2. IPC 通道层 (`constants.ts`)

新增两个渲染进程推送通道：

- **`task:streamToken`**：主进程推送单个 token 文本，渲染进程追加到当前流式消息
- **`task:streamEnd`**：主进程通知流式输出结束，渲染进程标记消息完成

这两个通道是单向推送（`webContents.send`），无需在 preload 中额外暴露——`window.electron.on()` 是通用监听器，接受任意通道字符串。

对比已有的 `task:nodeStart` / `task:nodeComplete`（工具执行事件）和 `task:completed`（任务完成事件），新增的通道填补了**LLM 思考过程**的实时展示空白。

### 3. 状态管理层 (`taskStore.ts`)

**Message 接口扩展**：新增 `streaming?: boolean` 字段，标识消息是否仍在接收中。

**新增三个方法**：

| 方法 | 触发时机 | 行为 |
|------|----------|------|
| `beginStreamingMessage()` | 收到第一个 token | 创建空 AI 消息（`content: ''`, `streaming: true`），记录 ID |
| `appendToStreamingMessage(token)` | 每个 token 到达 | 通过 ID 定位消息，追加 token 到 content |
| `finalizeStreamingMessage()` | 流结束 | 设置 `streaming: false`，清除 streamingMessageId |

Zustand 的 `set()` 是同步操作，token 追加只是字符串拼接 + array map，开销极低，高频调用不会成为瓶颈。

### 4. UI 层

**App.tsx — 事件监听**：新增两个 `useEffect` 监听器：
- `task:streamToken`：首次收到时调用 `beginStreamingMessage()` 创建消息，随后逐 token 追加
- `task:streamEnd`：调用 `finalizeStreamingMessage()` 结束流式状态

都经过 `isCurrentTaskEvent()` 过滤，确保只处理当前活跃任务的事件。

**ChatMessage.tsx — 闪烁光标**：当 `message.streaming === true` 时，在文本末尾渲染 `<span className="streaming-cursor" />`——一个 2px 宽、颜色为 `--color-primary` 的竖线，带 `opacity` 闪烁动画。

**ChatInput.tsx — 移除占位消息**：原代码在用户提交后立即插入一条 `"Task created, planning..."` 的 AI 占位消息。流式改造后，第一条 token 到达时 `beginStreamingMessage()` 会自动创建真正的 AI 消息，占位消息不再需要。

**index.css — 动画**：`@keyframes blink` 实现 1 秒周期的 step-end 闪烁。

---

## 数据流总览

```
用户提交任务
  │
  ▼
ChatInput → IPC invoke('task:start')
  │
  ▼
MainAgent.run()
  │
  ├─ ChatOpenAI (streaming: true) → SSE token stream
  │
  ├─ agent.stream({ streamMode: "messages" })
  │     │
  │     ├─ AIMessageChunk ──→ sendToRenderer('task:streamToken')
  │     │                         │
  │     │                         ▼
  │     │                      App.tsx 监听器
  │     │                         │
  │     │                         ├─ 首个 token → beginStreamingMessage()
  │     │                         │                 创建空流式消息
  │     │                         │
  │     │                         └─ 后续 token → appendToStreamingMessage()
  │     │                                           追加到 content
  │     │
  │     ├─ ... 更多 token / tool messages ...
  │     │
  │     └─ 流结束
  │           │
  │           ├─ sendToRenderer('task:streamEnd')
  │           │     └─→ finalizeStreamingMessage()
  │           │
  │           └─ agent.getState()
  │                 └─→ 获取聚合后的完整状态（含合并的 messages）
  │
  ├─ extractSteps() / extractFinalMessage()
  │
  └─ sendTaskCompleted()
        └─→ sendToRenderer('task:completed')
              └─→ addMessage({ role: 'ai', content: result, steps })
```

---

## 未改动的部分

- **`src/llm/OpenAIResponses.ts` / `LLMClient.ts`**：这些是独立于 LangChain 的 HTTP 客户端，仅被 Planner、Replanner、RecoveryEngine 等批处理组件使用，不做流式展示，无需改动。
- **`TaskEngine`**：独立的非 LangGraph 任务引擎，有自己的事件推送体系，不受影响。
- **`restoreFromState()`**：任务恢复场景仍使用 `invoke()`，因为用户不需要实时观看恢复过程。
- **`task:completed` 处理**：App.tsx 中原有的完成处理逻辑保持不变，流式消息和最终结果消息会共存于对话中。

## 架构决策

### 为什么用 `stream()` 而非 `streamEvents()`

`streamEvents()` 返回的是 LangChain callback tracer 事件流，事件类型包括 `on_chain_start`、`on_chat_model_start`、`on_chat_model_stream`、`on_tool_start`、`on_tool_end` 等。虽然粒度更细，但：
- 需要额外过滤才能拿到 token 事件
- 事件量更大，增加不必要的 IPC 开销
- 工具调用事件已有 `sendNodeStart`/`sendNodeComplete` 独立处理

`stream({ streamMode: "messages" })` 直接产出消息对象，天然按 token chunk 分割，代码更简洁。

### 为什么 `restoreFromState` 保持 `invoke()`

- 恢复场景是后台操作，用户不需要实时观看
- 改动范围最小化，降低风险
- `invoke()` 的阻塞语义更简单，不需要处理流的中途取消
