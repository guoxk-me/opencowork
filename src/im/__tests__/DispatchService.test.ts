import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IMAttachment, IMBot, IMMessage, IMNotification } from '../types';
import { getBindingStore } from '../store/bindingStore';
import { getDefaultDesktopUserId } from '../desktopBinding';

const mockAgentRun = vi.fn();
const mockAgentSetThreadId = vi.fn();
const mockStartRun = vi.fn();
const mockExecuteRun = vi.fn();
const mockSetUserBinding = vi.fn();

vi.mock('../../main/ipcHandlers', () => ({
  getSharedMainAgent: () => ({
    run: mockAgentRun,
    setThreadId: mockAgentSetThreadId,
  }),
}));

vi.mock('../ProgressEmitter', () => ({
  getProgressEmitter: () => ({
    setUserBinding: mockSetUserBinding,
  }),
}));

vi.mock('../../core/task/TaskOrchestrator', () => ({
  getTaskOrchestrator: () => ({
    startRun: mockStartRun,
    executeRun: mockExecuteRun,
  }),
}));

import { createDispatchService } from '../DispatchService';

class MockBot implements IMBot {
  platform = 'feishu' as const;
  sendMessage = vi.fn(async (_conversationId: string, _message: string) => undefined);
  sendAttachment = vi.fn(async (_conversationId: string, _attachment: IMAttachment) => undefined);
  pushNotification = vi.fn(async (_userId: string, _notification: IMNotification) => undefined);
  initialize = vi.fn(async () => undefined);
  onMessage = vi.fn();
  bindUser = vi.fn(async () => undefined);
  getBinding = vi.fn(async () => null);
  verifySignature = vi.fn(() => true);
}

describe('DispatchService', () => {
  let bot: MockBot;
  let tempDir: string | null = null;

  beforeEach(() => {
    bot = new MockBot();
    mockAgentRun.mockReset();
    mockAgentSetThreadId.mockReset();
    mockStartRun.mockReset();
    mockExecuteRun.mockReset();
    mockSetUserBinding.mockReset();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
    getBindingStore().clear();
    vi.clearAllMocks();
  });

  it('creates a default task from attachment-only messages and passes local paths to the agent', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-im-'));
    const attachmentPath = path.join(tempDir, 'input.txt');
    fs.writeFileSync(attachmentPath, 'hello');

    mockAgentRun.mockResolvedValue({
      success: true,
      output: 'done',
      finalMessage: 'done',
    });
    mockExecuteRun.mockImplementation(async (_runId: string, runner: () => Promise<unknown>) => runner());

    const service = createDispatchService(bot);
    const message: IMMessage = {
      id: 'm1',
      platform: 'feishu',
      userId: 'user-1',
      content: '',
      type: 'file',
      timestamp: Date.now(),
      conversationId: 'chat-1',
      chatType: 'p2p',
      messageId: 'msg-1',
      attachments: [
        {
          type: 'file',
          fileName: 'input.txt',
          localPath: attachmentPath,
          mimeType: 'text/plain',
        },
      ],
    };

    await service.handleMessage(message);

    expect(mockAgentRun).toHaveBeenCalledTimes(1);
    const prompt = mockAgentRun.mock.calls[0][0] as string;
    expect(prompt).toContain('处理我刚发送的文件：input.txt');
    expect(prompt).toContain(`本地路径: ${attachmentPath}`);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('任务已接收'),
      'p2p'
    );
  });

  it('sends file and link artifacts back to Feishu after task completion', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-im-'));
    const outputPath = path.join(tempDir, 'report.pdf');
    fs.writeFileSync(outputPath, 'pdf-content');

    mockExecuteRun.mockResolvedValue({
      id: 'result-1',
      summary: 'completed',
      artifacts: [
        {
          id: 'artifact-1',
          type: 'file',
          name: 'Report',
          uri: outputPath,
        },
        {
          id: 'artifact-2',
          type: 'link',
          name: 'Dashboard',
          uri: 'https://example.com/result',
        },
      ],
      reusable: true,
      completedAt: Date.now(),
    });

    const service = createDispatchService(bot);
    const message: IMMessage = {
      id: 'm2',
      platform: 'feishu',
      userId: 'user-2',
      content: '生成报告',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-2',
      chatType: 'p2p',
      messageId: 'msg-2',
    };

    await service.handleMessage(message);

    expect(bot.pushNotification).not.toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-2',
      expect.stringContaining('✅ 任务执行完成'),
      'p2p'
    );
    expect(bot.sendAttachment).toHaveBeenCalledWith(
      'chat-2',
      expect.objectContaining({
        type: 'file',
        localPath: outputPath,
        fileName: 'report.pdf',
      }),
      'p2p'
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-2',
      expect.stringContaining('https://example.com/result'),
      'p2p'
    );
  });

  it('re-sends the most recent generated file when the user asks for it', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-im-'));
    const outputPath = path.join(tempDir, 'deck.pptx');
    fs.writeFileSync(outputPath, 'pptx-content');

    mockExecuteRun.mockResolvedValue({
      id: 'result-2',
      summary: `PPT 已生成：${outputPath}`,
      artifacts: [
        {
          id: 'artifact-2',
          type: 'file',
          name: 'deck.pptx',
          uri: outputPath,
        },
      ],
      reusable: true,
      completedAt: Date.now(),
    });

    const service = createDispatchService(bot);
    await service.handleMessage({
      id: 'm4',
      platform: 'feishu',
      userId: 'user-4',
      content: '生成一个PPT',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-4',
      chatType: 'p2p',
      messageId: 'msg-4',
    });

    await service.handleMessage({
      id: 'm5',
      platform: 'feishu',
      userId: 'user-4',
      content: '把这个ppt发给我',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-4',
      chatType: 'p2p',
      messageId: 'msg-5',
    });

    expect(bot.sendAttachment).toHaveBeenCalledTimes(2);
    expect(bot.sendAttachment).toHaveBeenCalledWith(
      'chat-4',
      expect.objectContaining({
        type: 'file',
        localPath: outputPath,
        fileName: 'deck.pptx',
      }),
      'p2p'
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-4',
      expect.stringContaining('已发送最近生成的文件'),
      'p2p'
    );
  });

  it('replies to the originating group thread instead of private chat', async () => {
    mockAgentRun.mockResolvedValue({
      success: true,
      output: 'done',
      finalMessage: 'done',
    });
    mockExecuteRun.mockImplementation(async (_runId: string, runner: () => Promise<unknown>) => runner());

    const service = createDispatchService(bot);
    const message: IMMessage = {
      id: 'm3',
      platform: 'feishu',
      userId: 'user-3',
      content: '任务 帮我处理一下',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-group-1',
      chatType: 'group',
      messageId: 'msg-group-1',
    };

    await service.handleMessage(message);

    expect(bot.pushNotification).not.toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'msg-group-1',
      expect.stringContaining('✅ 任务执行完成'),
      'group'
    );
  });

  it('binds the current Feishu account to the single-device desktop user', async () => {
    const service = createDispatchService(bot);
    await service.handleMessage({
      id: 'm6',
      platform: 'feishu',
      userId: 'im-user-1',
      content: '绑定设备',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-6',
      chatType: 'p2p',
      messageId: 'msg-6',
    });

    const binding = getBindingStore().get('im-user-1');
    expect(binding?.desktopUserId).toBe(getDefaultDesktopUserId());
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-6',
      expect.stringContaining('已将当前飞书账号绑定到这台设备'),
      'p2p'
    );
  });
});
