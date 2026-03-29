/**
 * Main Agent - LangGraph ReAct 主 Agent
 * 负责任务理解、分发、结果汇总
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getCheckpointer, AgentCheckpointer } from '../checkpointers/agentCheckpointer';

export interface AgentConfig {
  modelName?: string;
  temperature?: number;
  threadId?: string;
  checkpointerEnabled?: boolean;
}

export interface AgentResult {
  success: boolean;
  output?: any;
  error?: string;
  messages?: any[];
}

// Browser Tool 定义
const browserTool = tool(
  async (params: { action: string; url?: string; selector?: string; text?: string }) => {
    console.log('[BrowserTool] Executing:', params);
    return { success: true, action: params.action, result: 'Browser operation completed' };
  },
  {
    name: 'browser',
    description: '浏览器操作工具，支持 goto/click/input/wait/extract/screenshot',
    schema: z.object({
      action: z.enum(['goto', 'click', 'input', 'wait', 'extract', 'screenshot']),
      url: z.string().optional(),
      selector: z.string().optional(),
      text: z.string().optional(),
    }),
  }
);

// CLI Tool 定义
const cliTool = tool(
  async (params: { command: string; args?: string[] }) => {
    console.log('[CLITool] Executing:', params);
    return { success: true, command: params.command, result: 'CLI operation completed' };
  },
  {
    name: 'cli',
    description: '系统命令执行工具',
    schema: z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
    }),
  }
);

// Vision Tool 定义
const visionTool = tool(
  async (params: { action: string; target?: string }) => {
    console.log('[VisionTool] Executing:', params);
    return { success: true, action: params.action, result: 'Vision operation completed' };
  },
  {
    name: 'vision',
    description: '视觉处理工具',
    schema: z.object({
      action: z.enum(['ocr', 'analyze', 'screenshot']),
      target: z.string().optional(),
    }),
  }
);

// Planner Tool 定义
const plannerTool = tool(
  async (params: { task: string; context?: string }) => {
    console.log('[PlannerTool] Executing:', params);
    return { success: true, task: params.task, result: 'Planning completed' };
  },
  {
    name: 'planner',
    description: '任务规划工具',
    schema: z.object({
      task: z.string(),
      context: z.string().optional(),
    }),
  }
);

const availableTools = [browserTool, cliTool, visionTool, plannerTool];

const STATE_MODIFIER = `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。

可用工具：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
2. cli - 用于执行系统命令
3. vision - 用于分析图片和屏幕内容
4. planner - 用于分析和规划复杂任务

根据用户任务，选择合适的工具来完成任务。
如果任务需要多个步骤，请按顺序执行。`;

export class MainAgent {
  private agent: any;
  private config: AgentConfig;
  private threadId: string;
  private model: ChatOpenAI;
  private checkpointer: AgentCheckpointer;
  private checkpointerEnabled: boolean;

  constructor(config: AgentConfig = {}) {
    this.config = {
      modelName: config.modelName || 'gpt-4-turbo',
      temperature: config.temperature || 0,
      checkpointerEnabled: config.checkpointerEnabled !== false,
    };
    this.threadId = config.threadId || `thread-${Date.now()}`;
    this.model = new ChatOpenAI({
      model: this.config.modelName,
      temperature: this.config.temperature,
    });
    this.checkpointer = getCheckpointer({ type: 'memory' });
    this.checkpointerEnabled = this.config.checkpointerEnabled ?? true;
  }

  async initialize(): Promise<void> {
    this.agent = createReactAgent({
      llm: this.model,
      tools: availableTools,
      stateModifier: STATE_MODIFIER,
    });

    console.log('[MainAgent] Initialized, thread:', this.threadId);
  }

  async run(task: string): Promise<AgentResult> {
    if (!this.agent) {
      await this.initialize();
    }

    console.log('[MainAgent] Running task:', task);

    try {
      const result = await this.agent.invoke(
        { messages: [{ role: 'user', content: task }] },
        { configurable: { thread_id: this.threadId } }
      );

      console.log('[MainAgent] Task completed');
      return {
        success: true,
        output: result,
        messages: result.messages,
      };
    } catch (error: any) {
      console.error('[MainAgent] Task failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
  }

  getThreadId(): string {
    return this.threadId;
  }

  isCheckpointerEnabled(): boolean {
    return this.checkpointerEnabled;
  }
}

export async function createMainAgent(config?: AgentConfig): Promise<MainAgent> {
  const agent = new MainAgent(config);
  await agent.initialize();
  return agent;
}

export default MainAgent;
