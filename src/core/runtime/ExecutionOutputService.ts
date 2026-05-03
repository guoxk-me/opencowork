import {
  createExecutionOutput,
  createRuntimeError,
  ExecutionOutput,
  ExecutionOutputStatus,
  ExecutionTargetKind,
  RuntimeArtifact,
  RuntimeError,
  RuntimeErrorCode,
} from '../../shared/protocol';
import { RuntimeArtifactStore, getRuntimeArtifactStore } from './RuntimeArtifactStore';
import { getRuntimeConfigService } from './RuntimeConfigService';

export interface ExecutionOutputServiceOptions {
  maxInlineOutputBytes?: number;
  artifactStore?: RuntimeArtifactStore;
}

export interface BuildExecutionOutputParams {
  runId: string;
  actionId?: string;
  target: ExecutionTargetKind;
  status: ExecutionOutputStatus;
  summary: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  error?: RuntimeError | {
    code: RuntimeErrorCode | string;
    message: string;
    recoverable: boolean;
  };
  metadata?: Record<string, unknown>;
}

const DEFAULT_MAX_INLINE_OUTPUT_BYTES = 64 * 1024;

export class ExecutionOutputService {
  private readonly maxInlineOutputBytes: number;
  private readonly artifactStore: RuntimeArtifactStore;

  constructor(options: ExecutionOutputServiceOptions = {}) {
    this.maxInlineOutputBytes =
      options.maxInlineOutputBytes ||
      getRuntimeConfigService().get().maxInlineOutputBytes ||
      DEFAULT_MAX_INLINE_OUTPUT_BYTES;
    this.artifactStore = options.artifactStore || getRuntimeArtifactStore();
  }

  build(params: BuildExecutionOutputParams): ExecutionOutput {
    const artifacts: RuntimeArtifact[] = [];
    const stdout = this.prepareStream(params.runId, 'stdout', params.stdout, artifacts);
    const stderr = this.prepareStream(params.runId, 'stderr', params.stderr, artifacts);
    const error = params.error
      ? 'version' in params.error
        ? params.error
        : createRuntimeError(params.error)
      : undefined;

    return createExecutionOutput({
      runId: params.runId,
      actionId: params.actionId,
      target: params.target,
      status: params.status,
      summary: params.summary,
      stdout,
      stderr,
      exitCode: params.exitCode,
      durationMs: params.durationMs,
      truncated: artifacts.length > 0 || undefined,
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      error,
      metadata: params.metadata,
    });
  }

  private prepareStream(
    runId: string,
    streamName: 'stdout' | 'stderr',
    value: string | undefined,
    artifacts: RuntimeArtifact[]
  ): string | undefined {
    if (!value) {
      return value;
    }

    if (Buffer.byteLength(value, 'utf-8') <= this.maxInlineOutputBytes) {
      return value;
    }

    artifacts.push(
      this.artifactStore.saveTextArtifact({
        runId,
        kind: 'log',
        title: `Full ${streamName}`,
        content: value,
        extension: `${streamName}.log`,
        metadata: { stream: streamName },
      })
    );

    return truncateUtf8(value, this.maxInlineOutputBytes);
  }
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, 'utf-8');
  if (buffer.byteLength <= maxBytes) {
    return value;
  }
  return buffer.subarray(0, maxBytes).toString('utf-8') + '\n[truncated]';
}

let executionOutputService: ExecutionOutputService | null = null;

export function getExecutionOutputService(): ExecutionOutputService {
  if (!executionOutputService) {
    executionOutputService = new ExecutionOutputService();
  }
  return executionOutputService;
}

export function resetExecutionOutputService(): void {
  executionOutputService = null;
}
