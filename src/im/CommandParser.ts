import { ParsedCommand } from './types';

export class CommandParser {
  private static readonly COMMANDS = {
    TASK: '任务',
    TEMPLATE: '模板',
    STATUS: '状态',
    LIST: '列表',
    BIND_DEVICE: '绑定设备',
    TAKEOVER: '接管',
    RETURN: '交还',
    CANCEL: '取消',
    HELP: '帮助',
    SEND_FILE: '发送文件',
    FILE: '文件',
  } as const;

  parse(content: string): ParsedCommand | null {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (cmd === CommandParser.COMMANDS.TASK) {
      return { command: 'task', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.TEMPLATE) {
      return { command: 'template', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.STATUS) {
      return { command: 'status', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.LIST) {
      return { command: 'list', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.BIND_DEVICE) {
      return { command: 'bindDevice', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.TAKEOVER) {
      return { command: 'takeover', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.RETURN) {
      return { command: 'return', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.CANCEL) {
      return { command: 'cancel', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.HELP) {
      return { command: 'help', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.SEND_FILE || cmd === CommandParser.COMMANDS.FILE) {
      return { command: 'sendFile', args, raw: content };
    }

    return { command: 'task', args: [trimmed], raw: content };
  }

  getHelp(): string {
    return `
📋 OpenCowork 命令帮助

• 任务 [描述] - 发送新任务
  例: @机器人 任务 帮我查下北京天气

• 模板 列表 - 查看可用模板
  例: @机器人 模板 列表

• 模板 运行 [模板名/ID] [key=value ...] - 按模板执行任务
  例: @机器人 模板 运行 招聘日报 keyword=AI 城市=北京

• 状态 [任务ID] - 查询任务状态
  例: @机器人 状态 abc123

• 列表 - 查看最近任务
  例: @机器人 列表

• 绑定设备 - 将当前飞书账号绑定到这台设备
  例: @机器人 绑定设备

• 接管 [任务ID] - 接管任务
  例: @机器人 接管 abc123

• 交还 - 交还控制给AI
  例: @机器人 交还

• 取消 [任务ID] - 取消任务
  例: @机器人 取消 abc123

• 帮助 - 显示帮助
  例: @机器人 帮助

• 发送文件 [本地路径] - 直接发送本地文件到飞书
  例: @机器人 发送文件 /tmp/虚沅数公司介绍.pptx
`.trim();
  }
}
