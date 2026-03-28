import { AnyAction, Plan, PlanNode, PlanEdge, ActionType, generateId } from '../action/ActionSchema';
import { getLLMClient } from '../../llm/OpenAIResponses';
import { LLMMessage } from '../../llm/LLMClient';

interface PlanContext {
  currentUrl?: string;
  availableActions?: string[];
  previousResults?: Record<string, any>;
  userPreferences?: any;
  conversationHistory?: Array<{role: string, content: string}>;
  currentPageContent?: string;
}

interface ReplanRequest {
  trigger: string;
  failedNodeId?: string;
  error?: string;
  executionState?: any;
  remainingPlan?: Plan;
}

interface ReplanResult {
  success: boolean;
  newPlan?: Plan;
  message?: string;
  canContinue: boolean;
}

export class TaskPlanner {
  private systemPrompt = `你是一个任务规划助手，负责将用户任务分解为可执行的步骤序列。

可用Action类型：
- browser:navigate(url) - 导航到URL
- browser:click(selector, index?, textMatch?) - 点击元素（**不是提取**）
- browser:input(selector, text, clear?, pressEnter?) - 输入文本
- browser:wait(selector, timeout?) - 等待元素出现
- browser:extract(selector, type) - 提取页面数据（仅用于读取数据，不是点击）
- browser:screenshot(fullPage?) - 页面截图
- cli:execute(command) - 执行CLI命令
- ask:user(question, options?) - 询问用户确认

重要规则：
1. **如果任务是"点击"、"打开"、"进入"某元素，必须使用 browser:click，不是 browser:extract**
2. 每个步骤必须对应一个可执行的Action
3. 对于复杂决策点，使用 ask:user 让用户确认
4. 描述要简洁明确，便于用户理解
5. 输出必须是有效的JSON格式
6. **选择器只返回纯CSS选择器**，禁止返回中文描述或自然语言
   - ✅ 正确: "button[type='submit']", ".article-card a", "#search-input"
   - ❌ 错误: "文章列表容器内的第一个链接"、"找到搜索按钮"
7. 选择器必须精确匹配目标元素：
   - 优先使用 ID (#id) 或唯一类名
   - 使用属性选择器：[type="submit"]、[name="search"]
   - 使用 textMatch 匹配按钮文本，如 "搜索"、"登录"
   - 避免使用模糊选择器如 "button"、"input"、"a"（除非用 index 限定）
   - index 仅作为最后手段
8. **搜索类任务**（如"搜索XX"、"在XX网站搜索XX"）：
   - 必须使用 browser:input 并指定 pressEnter: true
   - ✅ 正确: browser:input + pressEnter: true
   - ❌ 错误: browser:input + browser:click 组合

输出格式示例：
{
  "nodes": [
    {
      "id": "node1",
      "type": "action",
      "action": {
        "type": "browser:navigate",
        "description": "打开百度首页",
        "params": { "url": "https://www.baidu.com" }
      }
    }
  ],
  "edges": [
    { "from": "root", "to": "node1", "type": "always" }
  ]
}`;

  async plan(task: string, context: PlanContext): Promise<Plan> {
    console.log(`[TaskPlanner] Planning task:`, task);

    try {
      const llm = getLLMClient();

      const userPrompt = `用户任务：${task}

当前上下文：
- 当前页面：${context.currentUrl || '无'}
- 当前页面内容摘要：${context.currentPageContent ? context.currentPageContent.substring(0, 500) + '...' : '无'}
${context.conversationHistory?.length ? `- 会话历史：
${context.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}` : '- 会话历史：无'}
- 可用Actions：${context.availableActions?.join(', ') || '全部'}
${context.previousResults ? `- 上一步结果：${JSON.stringify(context.previousResults)}` : ''}

请将任务分解为可执行的步骤序列，输出JSON格式的计划。`;

      const messages: LLMMessage[] = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      console.log('[TaskPlanner] Calling LLM...');
      const response = await llm.chat(messages);

      console.log('[TaskPlanner] LLM response:', response.content);

      const plan = this.parseLLMResponse(response.content, task);
      
      if (plan && plan.nodes.length > 0) {
        return plan;
      }

      console.warn('[TaskPlanner] LLM response invalid, falling back to simple decompose');
      return this.createSimplePlan(task);
    } catch (error) {
      console.error('[TaskPlanner] LLM planning failed:', error);
      return this.createSimplePlan(task);
    }
  }

  async replan(request: ReplanRequest): Promise<ReplanResult> {
    console.log(`[TaskPlanner] Replanning due to:`, request.trigger);

    try {
      const llm = getLLMClient();

      const userPrompt = `任务需要重新规划。

原因：${request.trigger}
失败节点：${request.failedNodeId || '无'}
错误信息：${request.error || '无'}
当前执行状态：${JSON.stringify(request.executionState || {})}

剩余计划：${JSON.stringify(request.remainingPlan || { nodes: [] })}

请生成新的计划，输出JSON格式。`;

      const messages: LLMMessage[] = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await llm.chat(messages);
      const newPlan = this.parseLLMResponse(response.content, '');

      if (newPlan && newPlan.nodes.length > 0) {
        return {
          success: true,
          newPlan,
          message: 'Replanned successfully',
          canContinue: true,
        };
      }

      return {
        success: false,
        message: 'Failed to parse LLM response',
        canContinue: false,
      };
    } catch (error) {
      console.error('[TaskPlanner] Replanning failed:', error);
      return {
        success: false,
        message: `Replanning error: ${error instanceof Error ? error.message : 'Unknown'}`,
        canContinue: false,
      };
    }
  }

  validate(plan: Plan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!plan.id) errors.push('Plan must have an id');
    if (!plan.rootNodeId) errors.push('Plan must have a rootNodeId');
    if (plan.nodes.length === 0) errors.push('Plan must have at least one node');

    const nodeIds = new Set(plan.nodes.map((n) => n.id));
    for (const edge of plan.edges) {
      if (!nodeIds.has(edge.from)) errors.push(`Edge references unknown node: ${edge.from}`);
      if (!nodeIds.has(edge.to)) errors.push(`Edge references unknown node: ${edge.to}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private parseLLMResponse(content: string, task: string): Plan | null {
    try {
      let jsonStr = content.trim();
      
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      const nodes: PlanNode[] = [];
      const edges: PlanEdge[] = [];

      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        for (const node of parsed.nodes) {
          const action = this.parseAction(node.action);
          if (action) {
            nodes.push({
              id: node.id || generateId(),
              action,
              type: node.type || 'action',
              metadata: {
                description: node.action?.description || action.description,
                canUserTakeover: true,
              },
            });
          }
        }
      }

      if (parsed.edges && Array.isArray(parsed.edges)) {
        for (const edge of parsed.edges) {
          edges.push({
            from: edge.from || 'root',
            to: edge.to,
            type: edge.type || 'always',
          });
        }
      }

      if (nodes.length === 0) {
        return null;
      }

      const rootNodeId = nodes[0].id;

      return {
        id: generateId(),
        nodes,
        edges,
        rootNodeId,
      };
    } catch (error) {
      console.error('[TaskPlanner] Failed to parse LLM response:', error);
      return null;
    }
  }

  private parseAction(actionJson: any): AnyAction | null {
    if (!actionJson) return null;

    const type = actionJson.type || '';
    const params = actionJson.params || {};
    const description = actionJson.description || '';

    switch (type) {
      case 'browser:navigate':
        return {
          id: generateId(),
          type: ActionType.BROWSER_NAVIGATE,
          description,
          params: {
            url: params.url,
            waitUntil: params.waitUntil || 'domcontentloaded',
          },
        };

      case 'browser:click':
        return {
          id: generateId(),
          type: ActionType.BROWSER_CLICK,
          description,
          params: {
            selector: params.selector,
            index: params.index || 0,
          },
        };

      case 'browser:input':
        return {
          id: generateId(),
          type: ActionType.BROWSER_INPUT,
          description,
          params: {
            selector: params.selector,
            text: params.text,
            clear: params.clear !== false,
            delay: params.delay || 0,
            pressEnter: params.pressEnter || false,
          },
        };

      case 'browser:wait':
        return {
          id: generateId(),
          type: ActionType.BROWSER_WAIT,
          description,
          params: {
            selector: params.selector,
            timeout: params.timeout || 10000,
            state: params.state || 'visible',
          },
        };

      case 'browser:extract':
        return {
          id: generateId(),
          type: ActionType.BROWSER_EXTRACT,
          description,
          params: {
            selector: params.selector,
            type: params.type || 'text',
            multiple: params.multiple || false,
          },
        };

      case 'browser:screenshot':
        return {
          id: generateId(),
          type: ActionType.BROWSER_SCREENSHOT,
          description,
          params: {
            fullPage: params.fullPage || false,
            selector: params.selector,
          },
        };

      case 'cli:execute':
        return {
          id: generateId(),
          type: ActionType.CLI_EXECUTE,
          description,
          params: {
            command: params.command,
            workingDir: params.workingDir,
            env: params.env,
          },
        };

      case 'ask:user':
        return {
          id: generateId(),
          type: ActionType.ASK_USER,
          description,
          params: {
            question: params.question,
            options: params.options,
            defaultResponse: params.defaultResponse,
          },
          constraints: {
            timeout: params.timeout || 300000,
            retries: 0,
            requiresConfirm: true,
          },
        };

      default:
        console.warn('[TaskPlanner] Unknown action type:', type);
        return null;
    }
  }

  private createSimplePlan(task: string): Plan {
    console.log('[TaskPlanner] Creating simple plan for:', task);

    const actions = this.simpleDecompose(task);
    const nodes: PlanNode[] = [];
    const edges: PlanEdge[] = [];

    let prevNodeId: string | null = null;

    for (const action of actions) {
      const nodeId = generateId();

      nodes.push({
        id: nodeId,
        action,
        type: 'action',
        metadata: {
          description: action.description,
          canUserTakeover: true,
        },
      });

      if (prevNodeId) {
        edges.push({
          from: prevNodeId,
          to: nodeId,
          type: 'success',
        });
      }

      prevNodeId = nodeId;
    }

    const rootNodeId = nodes[0]?.id || generateId();

    if (nodes.length > 0 && edges.length === 0) {
      edges.push({
        from: 'root',
        to: nodes[0].id,
        type: 'always',
      });
    }

    return {
      id: generateId(),
      nodes,
      edges,
      rootNodeId,
    };
  }

  private simpleDecompose(task: string): AnyAction[] {
    const taskLower = task.toLowerCase();
    const urlMap: Record<string, string> = {
      '百度': 'https://www.baidu.com',
      'google': 'https://www.google.com',
      '谷歌': 'https://www.google.com',
      '淘宝': 'https://www.taobao.com',
      '天猫': 'https://www.tmall.com',
      '京东': 'https://www.jd.com',
      'github': 'https://github.com',
      'bilibili': 'https://www.bilibili.com',
      '知乎': 'https://www.zhihu.com',
    };

    if (taskLower.includes('打开') || taskLower.includes('导航') || taskLower.includes('访问')) {
      const urlMatch = task.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        return [{
          id: generateId(),
          type: ActionType.BROWSER_NAVIGATE,
          description: `导航到 ${urlMatch[0]}`,
          params: { url: urlMatch[0], waitUntil: 'domcontentloaded' },
        }];
      }

      for (const [keyword, url] of Object.entries(urlMap)) {
        if (taskLower.includes(keyword)) {
          return [{
            id: generateId(),
            type: ActionType.BROWSER_NAVIGATE,
            description: `导航到 ${keyword}`,
            params: { url, waitUntil: 'domcontentloaded' },
          }];
        }
      }
    }

    return [];
  }
}

export default TaskPlanner;