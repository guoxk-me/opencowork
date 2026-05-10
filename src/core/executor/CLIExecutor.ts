import { AnyAction, ActionResult, CLIExecuteAction } from '../action/ActionSchema';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getExecutionOutputService } from '../runtime/ExecutionOutputService';

const CLI_WHITELIST: Record<string, string[]> = {
  git: ['status', 'pull', 'push', 'clone', 'log', 'diff', 'branch', 'checkout', 'fetch'],
  npm: ['install', 'run', 'test', 'start', 'build', 'dev', 'lint'],
  node: ['--version', '-v'],
  python: ['--version', '-c', '-m'],
  python3: ['*', '--version', '-c', '-m'],
  pip: ['install', 'list', 'show', 'freeze'],
  curl: ['-s', '-S', '-L', '-o', '--max-time'],
  wget: ['-q', '-O', '--timeout'],
  ls: ['-la', '-l', '-a', '-R'],
  pwd: [],
  echo: ['*'],
  cat: [],
  mkdir: ['-p'],
  cd: [],
  touch: ['*'],
  'xdg-open': ['*'],
  gio: ['open'],
  go: ['version', 'run'],
};

const BLACKLIST_COMMANDS = ['rm -rf', 'dd', 'mkfs', ':(){:|:&};:', 'chmod -R 777', 'sudo', 'su'];

export class CLIExecutor {
  async execute(action: AnyAction): Promise<ActionResult> {
    const startTime = Date.now();

    if (action.type !== 'cli:execute') {
      return {
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: `Expected cli:execute, got ${action.type}`,
          recoverable: false,
        },
        duration: Date.now() - startTime,
      };
    }

    const cliAction = action as CLIExecuteAction;
    const { command, workingDir, env } = cliAction.params;
    const normalizedCommand = this.normalizeCommand(command, workingDir);
    const runId = (cliAction as unknown as { runId?: string }).runId || cliAction.id;

    console.log(`[CLIExecutor] Executing: ${normalizedCommand}`);

    const validation = this.validateCommand(normalizedCommand);
    if (!validation.valid) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        executionOutput: getExecutionOutputService().build({
          runId,
          actionId: cliAction.id,
          target: 'cli',
          status: 'failed',
          summary: validation.error || 'Command validation failed',
          durationMs: duration,
          error: {
            code: 'VALIDATION_FAILED',
            message: validation.error || 'Command validation failed',
            recoverable: false,
          },
          metadata: { command: normalizedCommand, workingDir },
        }),
        error: {
          code: 'VALIDATION_FAILED',
          message: validation.error || 'Command validation failed',
          recoverable: false,
        },
        duration,
      };
    }

    return new Promise((resolve) => {
      const options: any = {
        timeout: (cliAction.params as any).timeout || 60000,
        maxBuffer: 10 * 1024 * 1024,
      };

      if (workingDir) {
        options.cwd = workingDir;
      }

      if (env) {
        options.env = { ...process.env, ...env };
      }

      let timeoutId: NodeJS.Timeout | null = null;
      const commandTimeout = (cliAction.params as any).timeout || 60000;
      let settled = false;
      let child: ReturnType<typeof exec> | null = null;
      const finish = (result: ActionResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(result);
      };

      timeoutId = setTimeout(() => {
        console.error('[CLIExecutor] Command timed out:', command);
        const duration = Date.now() - startTime;
        if (child && !child.killed) {
          child.kill('SIGTERM');
        }
        finish({
          success: false,
          executionOutput: getExecutionOutputService().build({
            runId,
            actionId: cliAction.id,
            target: 'cli',
            status: 'timeout',
            summary: `Command timed out after ${commandTimeout}ms`,
            durationMs: duration,
            error: {
              code: 'TIMEOUT',
              message: `Command timed out after ${commandTimeout}ms`,
              recoverable: true,
            },
            metadata: { command: normalizedCommand, workingDir },
          }),
          error: {
            code: 'TIMEOUT',
            message: `Command timed out after ${commandTimeout}ms`,
            recoverable: true,
          },
          duration,
        });
      }, commandTimeout);

      child = exec(normalizedCommand, options, (error, stdout, stderr) => {
        if (settled) {
          return;
        }

        try {
          if (error) {
            console.error(`[CLIExecutor] Command failed:`, error.message);

            if (error.killed) {
              const duration = Date.now() - startTime;
              finish({
                success: false,
                executionOutput: getExecutionOutputService().build({
                  runId,
                  actionId: cliAction.id,
                  target: 'cli',
                  status: 'timeout',
                  summary: 'Command timed out after 60 seconds',
                  stdout: stdout.toString(),
                  stderr: stderr.toString(),
                  durationMs: duration,
                  error: {
                    code: 'TIMEOUT',
                    message: 'Command timed out after 60 seconds',
                    recoverable: true,
                  },
                  metadata: { command: normalizedCommand, workingDir },
                }),
                error: {
                  code: 'TIMEOUT',
                  message: 'Command timed out after 60 seconds',
                  recoverable: true,
                },
                duration,
              });
              return;
            }

            const duration = Date.now() - startTime;
            finish({
              success: false,
              output: stdout.toString(),
              executionOutput: getExecutionOutputService().build({
                runId,
                actionId: cliAction.id,
                target: 'cli',
                status: 'failed',
                summary: (stderr ? stderr.toString() : '') || error.message,
                stdout: stdout.toString(),
                stderr: stderr.toString(),
                exitCode: typeof error.code === 'number' ? error.code : undefined,
                durationMs: duration,
                error: {
                  code: 'NON_ZERO_EXIT',
                  message: (stderr ? stderr.toString() : '') || error.message,
                  recoverable: true,
                },
                metadata: { command: normalizedCommand, workingDir },
              }),
              error: {
                code: 'COMMAND_FAILED',
                message: (stderr ? stderr.toString() : '') || error.message,
                recoverable: true,
              },
              duration,
            });
            return;
          }

          console.log(`[CLIExecutor] Command succeeded`);
          const duration = Date.now() - startTime;

          finish({
            success: true,
            output: stdout.toString(),
            executionOutput: getExecutionOutputService().build({
              runId,
              actionId: cliAction.id,
              target: 'cli',
              status: 'success',
              summary: 'Command completed successfully',
              stdout: stdout.toString(),
              stderr: stderr.toString(),
              durationMs: duration,
              metadata: { command: normalizedCommand, workingDir },
            }),
            duration,
          });
        } catch (callbackError: any) {
          console.error('[CLIExecutor] Callback error:', callbackError);
          const duration = Date.now() - startTime;
          finish({
            success: false,
            executionOutput: getExecutionOutputService().build({
              runId,
              actionId: cliAction.id,
              target: 'cli',
              status: 'failed',
              summary: callbackError.message || String(callbackError),
              durationMs: duration,
              error: {
                code: 'CALLBACK_ERROR',
                message: callbackError.message || String(callbackError),
                recoverable: true,
              },
              metadata: { command: normalizedCommand, workingDir },
            }),
            error: {
              code: 'CALLBACK_ERROR',
              message: callbackError.message || String(callbackError),
              recoverable: true,
            },
            duration,
          });
        }
      });
    });
  }

  private normalizeCommand(command: string, workingDir?: string): string {
    if (!command.includes('create_ppt.py') || command.includes('--content-file')) {
      return command;
    }

    const match = command.match(/^(.*?create_ppt\.py\b.*?--content)\s+'([\s\S]*)'\s*$/);
    if (!match) {
      return command;
    }

    try {
      const [, prefix, rawContent] = match;
      const tempDir = workingDir || os.tmpdir();
      const tempFile = path.join(tempDir, `ppt-content-${Date.now()}.json`);
      fs.writeFileSync(tempFile, rawContent, 'utf-8');
      const quotedPath = JSON.stringify(tempFile);
      return prefix.replace(/--content$/, '--content-file') + ` ${quotedPath}`;
    } catch (error) {
      console.warn('[CLIExecutor] Failed to normalize PPT content command:', error);
      return command;
    }
  }

  private validateCommand(command: string): { valid: boolean; error?: string } {
    const trimmed = command.trim();
    const lower = trimmed.toLowerCase();

    for (const blocked of BLACKLIST_COMMANDS) {
      const escaped = blocked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      if (pattern.test(trimmed)) {
        return { valid: false, error: `Blocked command pattern: ${blocked}` };
      }
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 0) {
      return { valid: false, error: 'Empty command' };
    }

    const cmd = parts[0];
    const allowedCommands = CLI_WHITELIST[cmd];

    if (!allowedCommands) {
      return { valid: false, error: `Command not in whitelist: ${cmd}` };
    }

    if (allowedCommands.length === 0) {
      return { valid: true };
    }

    if (allowedCommands[0] === '*') {
      return { valid: true };
    }

    const subCmd = parts[1];
    if (subCmd && !allowedCommands.includes(subCmd)) {
      return { valid: false, error: `Subcommand not allowed: ${subCmd}` };
    }

    return { valid: true };
  }
}

export default CLIExecutor;
