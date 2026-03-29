# OpenCowork v0.4 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.4       |
| 更新日期 | 2026-03-29 |
| 状态     | 规划中     |
| 基于PRD  | v2.5       |
| 前置版本 | v0.3       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
4. [文件结构](#4-文件结构)
5. [实施计划](#5-实施计划)
6. [成功指标](#6-成功指标)

---

## 1. 版本目标

**目标**: 全量采用 LangChain/LangGraph TypeScript 版本替换现有架构，实现标准化 Agent 执行流程

### 核心目标

| 目标       | 说明                                       |
| ---------- | ------------------------------------------ |
| **标准化** | 使用 LangGraph StateGraph 作为核心执行框架 |
| **持久化** | 内置 Durable Execution，任务可恢复         |
| **记忆化** | Memory Store 替代 ShortTermMemory          |
| **可观测** | LangSmith 集成，运行时追踪                 |

### 版本变更说明

| 原版本         | 新版本        | 说明           |
| -------------- | ------------- | -------------- |
| v0.4 功能完备  | v0.5 功能完备 | 顺延至下一版本 |
| v0.5 Skill系统 | v0.6 定时任务 | 顺延           |
| v0.6 多端协同  | v0.7 多端协同 | 顺延           |
| v0.7 正式版    | v1.0 正式版   | 顺延           |

---

## 2. 技术架构

### 2.1 架构对比

| 模块         | v0.3 实现                 | v0.4 LangGraph 实现        |
| ------------ | ------------------------- | -------------------------- |
| **状态管理** | `Map<string, TaskHandle>` | StateSchema + Checkpointer |
| **任务执行** | PlanExecutor 线性执行     | StateGraph Nodes/Edges     |
| **规划器**   | TaskPlanner LLM 调用      | Agent Node + Tools         |
| **恢复机制** | RecoveryEngine 手动       | 内置 Durable Execution     |
| **记忆**     | ShortTermMemory 内存Map   | Memory Store               |
| **验证**     | Verifier 手动             | Graph State Validation     |
| **可观测**   | console.log 手动          | LangSmith 集成             |

### 2.2 LangGraph 主-子 Agent 架构图

```
User Task
    ↓
┌───────────────────────────────────────────────┐
│         Main Agent (ReAct)                   │
│                                               │
│   Tools (子Agent as Tool):                    │
│   ┌──────────────┐  ┌──────────────┐         │
│   │ Browser      │  │ Planner      │         │
│   │ SubAgent    │  │ SubAgent    │         │
│   │ (StateGraph)│  │ (StateGraph)│         │
│   └──────────────┘  └──────────────┘         │
│   ┌──────────────┐  ┌──────────────┐         │
│   │ CLI          │  │ Vision       │         │
│   │ SubAgent    │  │ SubAgent    │         │
│   │ (StateGraph)│  │ (StateGraph)│         │
│   └──────────────┘  └──────────────┘         │
└───────────────────────────────────────────────┘
    ↓
Web Page / CLI / Vision
```

### 2.3 核心原则

**原则1: 主-子 Agent 架构**

- 主 Agent (Main Agent): 使用 `createReactAgent`，负责任务理解、分发、结果汇总
- 子 Agent (SubAgent): 每个子 Agent 是独立的 StateGraph，精细控制特定领域操作
- 子 Agent 通过 LangChain Tool 接口暴露给主 Agent 调用

**原则2: Tool 封装 SubAgent**

- BrowserExecutor → BrowserSubAgent (StateGraph)
- CLIExecutor → CLISubAgent (StateGraph)
- VisionExecutor → VisionSubAgent (StateGraph)
- TaskPlanner → PlannerSubAgent (StateGraph)

**原则3: ReAct 决策 + StateGraph 执行**

- 主 Agent 使用 ReAct 模式，LLM 决定使用哪个子 Agent
- 子 Agent 内部使用 StateGraph 精细控制执行步骤
- 后续可轻松添加新子 Agent
- 不再手动规划步骤序列

---

## 3. 核心模块设计

### 3.1 StateSchema 定义

```typescript
// src/states/agentState.ts

import { StateSchema, MessagesValue } from '@langchain/langgraph';
import { z } from 'zod';

export const AgentState = new StateSchema({
  // 任务描述
  task: z.string(),

  // 对话历史 (LangGraph 内置)
  messages: MessagesValue,

  // 当前执行计划
  plan: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          action: z.any(),
        })
      ),
      edges: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
        })
      ),
    })
    .optional(),

  // 当前执行步骤
  currentStep: z.number().optional(),

  // 执行结果
  result: z
    .object({
      success: z.boolean(),
      output: z.any().optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          recoverable: z.boolean().optional(),
        })
        .optional(),
      duration: z.number().optional(),
    })
    .optional(),

  // 记忆数据
  memory: z.record(z.any()).optional(),

  // 验证结果
  verification: z
    .object({
      verified: z.boolean(),
      type: z.string(),
      message: z.string().optional(),
    })
    .optional(),

  // 重试计数
  retryCount: z.number().optional(),

  // 页面上下文
  pageContext: z
    .object({
      url: z.string().optional(),
      title: z.string().optional(),
      uiGraph: z.any().optional(),
    })
    .optional(),
});
```

### 3.2 Graph 节点设计

#### 3.2.1 Planner Node (规划节点)

```typescript
// src/nodes/plannerNode.ts

import { GraphNode } from '@langchain/langgraph';
import { AgentState } from '../states/agentState';
import { z } from 'zod';

const PlanInput = z.object({
  task: z.string(),
  context: z
    .object({
      currentUrl: z.string().optional(),
      previousResult: z.any().optional(),
      pageStructure: z.any().optional(),
    })
    .optional(),
});

export const plannerNode: GraphNode<typeof AgentState> = async (state, config) => {
  const { task } = state;
  const context = state.pageContext || {};

  // 调用 LLM 生成计划
  const llm = getLLMClient();
  const response = await llm.chat([
    {
      role: 'system',
      content: PLANNER_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `任务: ${task}\n当前页面: ${context.url}\n标题: ${context.title}`,
    },
  ]);

  const plan = JSON.parse(response.content);

  return {
    plan,
    currentStep: 0,
  };
};
```

#### 3.2.2 Executor Node (执行节点)

```typescript
// src/nodes/executorNode.ts

import { GraphNode } from '@langchain/langgraph';
import { AgentState } from '../states/agentState';

export const executorNode: GraphNode<typeof AgentState> = async (state, config) => {
  const { plan, currentStep } = state;

  if (!plan || !plan.nodes || plan.nodes.length === 0) {
    return {
      result: {
        success: false,
        error: { code: 'NO_PLAN', message: 'No plan to execute' },
      },
    };
  }

  const currentNode = plan.nodes[currentStep];
  if (!currentNode) {
    return {
      result: { success: true, output: null },
    };
  }

  // 执行当前节点 action
  const toolResult = await executeTool(currentNode.action);

  return {
    result: toolResult,
    currentStep: currentStep + 1,
  };
};
```

#### 3.2.3 Verifier Node (验证节点)

```typescript
// src/nodes/verifyNode.ts

import { GraphNode } from '@langchain/langgraph';
import { AgentState } from '../states/agentState';

export const verifyNode: GraphNode<typeof AgentState> = async (state, config) => {
  const { result, plan, currentStep } = state;

  if (!result) {
    return {
      verification: {
        verified: false,
        type: 'no_result',
        message: 'No result to verify',
      },
    };
  }

  // 验证执行结果
  const verified = verifyResult(result, plan, currentStep);

  if (verified) {
    return {
      verification: {
        verified: true,
        type: 'success',
        message: 'Action verified successfully',
      },
    };
  } else {
    return {
      verification: {
        verified: false,
        type: 'failed',
        message: result.error?.message || 'Action verification failed',
      },
      retryCount: (state.retryCount || 0) + 1,
    };
  }
};

function verifyResult(result: any, plan: any, step: number): boolean {
  if (!result.success) {
    return false;
  }

  // 根据 action 类型进行特定验证
  const action = plan?.nodes?.[step]?.action;
  if (!action) return true;

  return true;
}
```

#### 3.2.4 Memory Node (记忆节点)

```typescript
// src/nodes/memoryNode.ts

import { GraphNode } from '@langchain/langgraph';
import { AgentState } from '../states/agentState';

export const memoryNode: GraphNode<typeof AgentState> = async (state, config) => {
  const { result, task, pageContext } = state;

  // 记录到 Memory Store
  await recordToMemory({
    task,
    result,
    url: pageContext?.url,
    timestamp: Date.now(),
  });

  return {
    memory: {
      lastResult: result,
      lastTask: task,
    },
  };
};
```

### 3.3 Tools 设计

#### 3.3.1 Browser Tool

```typescript
// src/tools/browserTool.ts

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const BrowserParams = z.object({
  action: z.enum(['goto', 'click', 'input', 'wait', 'extract', 'screenshot', 'evaluate']),
  selector: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
  waitFor: z.string().optional(),
});

export const browserTool = tool(
  async (params, config) => {
    const { action, selector, text, url, timeout, waitFor } = params;

    // 从 config 获取 browser 实例
    const browser = getBrowserFromConfig(config);

    switch (action) {
      case 'goto':
        await browser.goto(url, { timeout: timeout || 30000 });
        return { success: true, url: browser.url() };

      case 'click':
        await browser.click(selector, { timeout: timeout || 10000 });
        return { success: true };

      case 'input':
        await browser.type(selector, text, { timeout: timeout || 10000 });
        return { success: true };

      case 'wait':
        await browser.waitForSelector(selector, { timeout: timeout || 10000 });
        return { success: true };

      case 'extract':
        const content = await browser.extract(selector);
        return { success: true, content };

      case 'screenshot':
        const screenshot = await browser.screenshot();
        return { success: true, screenshot };

      case 'evaluate':
        const evalResult = await browser.evaluate(selector);
        return { success: true, result: evalResult };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
  {
    name: 'browser',
    description: `浏览器操作工具，允许 AI 执行以下操作：
- goto: 导航到指定 URL
- click: 点击页面元素
- input: 在输入框中输入文本
- wait: 等待元素出现
- extract: 提取页面内容
- screenshot: 截取当前页面截图
- evaluate: 执行 JavaScript 代码

使用此工具完成网页自动化任务。`,
    schema: BrowserParams,
  }
);
```

#### 3.3.2 CLI Tool

```typescript
// src/tools/cliTool.ts

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const CLIParams = z.object({
  command: z.string().describe('要执行的命令'),
  args: z.array(z.string()).optional().describe('命令参数'),
  timeout: z.number().optional().describe('超时时间(毫秒)'),
});

export const cliTool = tool(
  async (params, config) => {
    const { command, args, timeout = 30000 } = params;

    // 检查白名单
    const allowed = checkWhitelist(command);
    if (!allowed) {
      return {
        success: false,
        error: `Command not allowed: ${command}`,
      };
    }

    // 执行命令
    const result = await executeCommand(command, args, timeout);

    return result;
  },
  {
    name: 'cli',
    description: `系统命令执行工具，用于执行白名单内的系统命令。
    
允许的命令示例：
- git: status, pull, push, clone, log
- npm: install, run, test, build
- ls, cd, mkdir, rm, cp, mv

使用此工具完成文件操作和开发任务。`,
    schema: CLIParams,
  }
);
```

#### 3.3.3 Vision Tool

```typescript
// src/tools/visionTool.ts

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const VisionParams = z.object({
  action: z.enum(['ocr', 'analyze', 'extract_text', 'describe']),
  image_path: z.string().describe('图片路径或 URL'),
  prompt: z.string().optional().describe('分析提示'),
  language: z.string().optional().describe('输出语言'),
});

export const visionTool = tool(
  async (params, config) => {
    const { action, image_path, prompt, language = 'zh-CN' } = params;

    switch (action) {
      case 'ocr':
        const text = await performOCR(image_path);
        return { success: true, text };

      case 'analyze':
        const analysis = await analyzeImage(image_path, prompt);
        return { success: true, analysis };

      case 'extract_text':
        const extracted = await extractTextFromImage(image_path);
        return { success: true, text: extracted };

      case 'describe':
        const description = await describeImage(image_path);
        return { success: true, description };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
  {
    name: 'vision',
    description: `视觉处理工具，用于分析图片和屏幕内容。
    
支持的操作：
- ocr: 光学字符识别，提取图片中的文字
- analyze: 使用 AI 分析图片内容
- extract_text: 提取图片中的文本内容
- describe: 描述图片内容

适用于截图分析、验证码识别等场景。`,
    schema: VisionParams,
  }
);
```

### 3.4 主 Agent 设计

```typescript
// src/agents/mainAgent.ts

import { createReactAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { browserTool } from '../tools/browserTool';
import { cliTool } from '../tools/cliTool';
import { visionTool } from '../tools/visionTool';
import { plannerTool } from '../tools/plannerTool';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

// 定义 LLM
const model = new ChatOpenAI({
  model: 'gpt-4-turbo',
  temperature: 0,
});

// 创建主 Agent
export const mainAgent = createReactAgent({
  llm: model,
  tools: [browserTool, cliTool, visionTool, plannerTool],
  stateModifier: `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。
  
你有两个子 Agent 可用：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
2. cli - 用于执行系统命令
3. vision - 用于分析图片和屏幕内容
4. planner - 用于分析和规划复杂任务

根据用户任务，选择合适的子 Agent 来完成。`,
});

// 配置 Checkpointer 实现持久化
const checkpointer = new SqliteSaver({
  connectionPath: './checkpoints.db',
});

// 编译带持久化的 Agent
export const agentWithCheckpoint = mainAgent.compile({
  checkpointer,
  configurable: {
    thread_id: 'user-session-1',
  },
});

// 使用示例
async function runTask(task: string) {
  const result = await agentWithCheckpoint.invoke(
    { messages: [{ role: 'user', content: task }] },
    { configurable: { thread_id: 'session-123' } }
  );
  return result;
}
```

### 3.5 子 Agent 基类设计

```typescript
// src/agents/subagents/baseSubAgent.ts

import { StateGraph, START, END } from '@langchain/langgraph';
import { z } from 'zod';

// 子 Agent 基础状态
export const BaseSubAgentState = new StateSchema({
  input: z.string(),
  output: z.any().optional(),
  error: z.string().optional(),
  step: z.number().default(0),
});

// 子 Agent 基类
export abstract class BaseSubAgent<T extends z.ZodType> {
  protected graph: StateGraph<T>;
  protected name: string;

  constructor(name: string, stateSchema: T) {
    this.name = name;
    this.graph = new StateGraph(stateSchema);
  }

  // 子类实现具体节点
  protected abstract addNodes(): void;

  // 编译子 Agent
  compile(checkpointer?: any) {
    this.addNodes();
    return this.graph.compile({ checkpointer });
  }

  // 转换为 Tool
  asTool() {
    return tool(
      async (input: string) => {
        const compiled = this.compile();
        const result = await compiled.invoke({ input });
        return result.output;
      },
      {
        name: this.name,
        description: this.getDescription(),
        schema: z.object({ input: z.string() }),
      }
    );
  }

  protected abstract getDescription(): string;
}
```

### 3.6 Browser SubAgent 设计 (StateGraph)

```typescript
// src/agents/subagents/browserSubAgent.ts

import { StateGraph, START, END } from '@langchain/langgraph';
import { z } from 'zod';

// Browser SubAgent 状态
const BrowserState = new StateSchema({
  action: z.enum(['goto', 'click', 'input', 'wait', 'extract']),
  params: z.any(),
  result: z.any().optional(),
  error: z.string().optional(),
});

// 定义节点
const prepareNode = (state: typeof BrowserState.Type) => ({
  ...state,
  error: undefined,
});

const executeNode = async (state: typeof BrowserState.Type) => {
  // 执行浏览器操作
  const result = await executeBrowserAction(state.action, state.params);
  return { result };
};

const errorNode = (state: typeof BrowserState.Type) => ({
  error: `Browser action failed: ${state.action}`,
});

// 构建 Graph
const workflow = new StateGraph(BrowserState)
  .addNode('prepare', prepareNode)
  .addNode('execute', executeNode)
  .addNode('error', errorNode)
  .addEdge(START, 'prepare')
  .addEdge('prepare', 'execute')
  .addEdge('execute', END);

// 编译
export const browserSubAgent = workflow.compile();

// 转换为 Tool 供主 Agent 调用
import { tool } from '@langchain/core/tools';

export const browserTool = tool(
  async ({ action, params }) => {
    const result = await browserSubAgent.invoke({ action, params });
    return result.result;
  },
  {
    name: 'browser',
    description: '浏览器操作子 Agent，用于执行网页自动化任务',
    schema: z.object({
      action: z.enum(['goto', 'click', 'input', 'wait', 'extract']),
      params: z.any(),
    }),
  }
);
```

### 3.7 Checkpointer 设计

```typescript
// src/checkpointers/sqlite.ts

import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

export function createSqliteCheckpointer(dbPath: string = './checkpoints.db') {
  return new SqliteSaver({
    connectionPath: dbPath,
  });
}

// 使用示例
const checkpointer = createSqliteCheckpointer();

const agent = workflow.compile({
  checkpointer,
  configurable: {
    thread_id: 'user-session-1',
  },
});
```

### 3.5 Memory Store 设计

```typescript
// src/memory/agentMemory.ts

import { MemoryStore, InMemoryStore } from '@langchain/langgraph';
import { z } from 'zod';

const MemorySchema = z.object({
  task: z.string(),
  result: z.any(),
  timestamp: z.number(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export class AgentMemory {
  private store: MemoryStore;

  constructor(store?: MemoryStore) {
    this.store = store || new InMemoryStore();
  }

  // 记录任务执行
  async record(
    task: string,
    result: any,
    context?: {
      url?: string;
      tags?: string[];
    }
  ) {
    const memory = {
      task,
      result,
      timestamp: Date.now(),
      url: context?.url,
      tags: context?.tags,
    };

    await this.store.put(['memories'], `task_${Date.now()}`, memory);
  }

  // 搜索相关记忆
  async search(query: string, limit: number = 5) {
    return await this.store.search(['memories'], { query, limit });
  }

  // 获取最近记忆
  async getRecent(limit: number = 10) {
    const memories = await this.store.search(['memories'], { limit });

    return memories.map((m) => m.value);
  }
}
```

---

## 4. 文件结构

### 4.1 删除的文件

```
src/core/runtime/TaskEngine.ts          # 原任务引擎
src/core/planner/PlanExecutor.ts        # 原计划执行器
src/core/planner/TaskPlanner.ts         # 原任务规划器
src/recovery/recoveryEngine.ts          # LangGraph 内置
src/memory/shortTermMemory.ts           # 替换为 Memory Store
src/browser/uiGraph.ts                  # LangGraph 管理
src/browser/observer.ts                 # LangGraph 管理
src/executor/verifier.ts                # 迁移到 State Validation
src/core/executor/BrowserExecutor.ts    # 封装为 SubAgent
src/core/executor/CLIExecutor.ts        # 封装为 SubAgent
src/core/executor/VisionExecutor.ts     # 封装为 SubAgent
```

### 4.2 新增的文件

```
src/
├── agents/
│   ├── mainAgent.ts           # 主 Agent (ReAct)
│   └── subagents/
│       ├── baseSubAgent.ts    # 子 Agent 基类
│       ├── browserSubAgent.ts # 浏览器子 Agent (StateGraph)
│       ├── plannerSubAgent.ts # 规划子 Agent (StateGraph)
│       ├── cliSubAgent.ts     # CLI 子 Agent (StateGraph)
│       └── visionSubAgent.ts  # Vision 子 Agent (StateGraph)
│
├── tools/
│   ├── browserTool.ts         # 浏览器工具 (封装 BrowserSubAgent)
│   ├── cliTool.ts             # CLI 工具 (封装 CLISubAgent)
│   ├── visionTool.ts          # Vision 工具 (封装 VisionSubAgent)
│   └── plannerTool.ts         # 规划工具 (封装 PlannerSubAgent)
│
├── checkpointers/
│   └── sqlite.ts              # SQLite Checkpointer
│
├── memory/
│   └── agentMemory.ts         # Memory Store 封装
│
├── states/
│   └── agentState.ts          # StateSchema 定义
│
├── config/
│   └── langchain.ts           # LangChain 配置
│
└── utils/
    └── logger.ts              # 日志工具 (LangSmith 替代)
```

### 4.3 修改的文件

```
src/main/ipcHandlers.ts          # 适配新 Agent
src/renderer/App.tsx           # 适配新执行模式
package.json                   # 添加 LangChain 依赖
```

### 4.4 主-子 Agent 调用关系

```
Main Agent (ReAct)
    │
    ├── Tool: browserTool → BrowserSubAgent (StateGraph)
    │   └── Nodes: navigate → click → input → extract
    │
    ├── Tool: cliTool → CLISubAgent (StateGraph)
    │   └── Nodes: validate → execute → output
    │
    ├── Tool: visionTool → VisionSubAgent (StateGraph)
    │   └── Nodes: capture → analyze → result
    │
    └── Tool: plannerTool → PlannerSubAgent (StateGraph)
        └── Nodes: analyze → decompose → validate
```

---

## 5. 实施计划

### 5.1 详细时间线 (12周)

| 阶段        | 周次       | 任务                              | 交付物                                                         |
| ----------- | ---------- | --------------------------------- | -------------------------------------------------------------- |
| **Phase 1** | Week 1-2   | 主 Agent 框架搭建 + Tool 接口定义 | mainAgent.ts, baseTool.ts                                      |
| **Phase 2** | Week 3-4   | Browser SubAgent (StateGraph)     | browserSubAgent.ts, browserTool.ts                             |
| **Phase 3** | Week 5-6   | Planner/CLI SubAgent              | plannerSubAgent.ts, cliSubAgent.ts, plannerTool.ts, cliTool.ts |
| **Phase 4** | Week 7-8   | Vision SubAgent + Checkpointer    | visionSubAgent.ts, visionTool.ts, sqlite.ts, 任务持久化        |
| **Phase 5** | Week 9-10  | Memory Store + Agent 间通信       | agentMemory.ts, 记忆功能                                       |
| **Phase 6** | Week 11-12 | LangSmith 集成 + 测试 + 发布      | 可观测性, v0.4 Release                                         |

### 5.2 依赖包

```json
{
  "dependencies": {
    "@langchain/langgraph": "latest",
    "@langchain/core": "latest",
    "@langchain/openai": "latest",
    "@langchain/langgraph-checkpoint-sqlite": "latest"
  }
}
```

### 5.3 里程碑

| 里程碑 | 周次    | 目标                                       |
| ------ | ------- | ------------------------------------------ |
| **M1** | Week 2  | 主 Agent 可运行，理解任务并调用 Tools      |
| **M2** | Week 4  | Browser SubAgent 完成，浏览器操作可执行    |
| **M3** | Week 6  | Planner/CLI SubAgent 完成，任务可规划      |
| **M4** | Week 8  | Vision SubAgent + Checkpointer，任务可恢复 |
| **M5** | Week 10 | Memory Store，跨会话记忆可用               |
| **M6** | Week 12 | v0.4 发布                                  |

---

## 6. 成功指标

| 指标       | v0.3   | v0.4 目标        | 说明                |
| ---------- | ------ | ---------------- | ------------------- |
| 任务成功率 | 85-95% | **90-98%**       | 更标准的 Agent 流程 |
| 代码行数   | -      | **-30%**         | 复用 LangGraph      |
| 恢复能力   | 手动   | **内置**         | Durable Execution   |
| 可观测性   | 手动   | **LangSmith**    | 运行时追踪          |
| 内存管理   | Map    | **Memory Store** | 语义搜索            |

---

### 6.1 测试指标

| 测试类型 | 覆盖率目标   |
| -------- | ------------ |
| 单元测试 | >80%         |
| 集成测试 | >60%         |
| E2E 测试 | 核心场景覆盖 |

---

_最后更新: 2026-03-29_
