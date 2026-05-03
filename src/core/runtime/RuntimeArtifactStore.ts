import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRuntimeArtifact, RuntimeArtifact, RuntimeArtifactKind } from '../../shared/protocol';

export interface RuntimeArtifactStoreOptions {
  baseDir?: string;
}

export interface SaveTextArtifactParams {
  runId: string;
  kind?: RuntimeArtifactKind;
  title: string;
  content: string;
  extension?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export class RuntimeArtifactStore {
  private readonly baseDir: string;

  constructor(options: RuntimeArtifactStoreOptions = {}) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || os.tmpdir();
    this.baseDir = options.baseDir || path.join(homeDir, '.opencowork', 'artifacts');
  }

  saveTextArtifact(params: SaveTextArtifactParams): RuntimeArtifact {
    const artifact = createRuntimeArtifact({
      runId: params.runId,
      kind: params.kind || 'log',
      title: params.title,
      mimeType: params.mimeType || 'text/plain',
      sizeBytes: Buffer.byteLength(params.content, 'utf-8'),
      metadata: params.metadata,
    });
    const runDir = path.join(this.baseDir, sanitizePathPart(params.runId));
    fs.mkdirSync(runDir, { recursive: true });
    const extension = params.extension || 'log';
    const filePath = path.join(runDir, `${sanitizePathPart(artifact.id)}.${extension}`);
    fs.writeFileSync(filePath, params.content, 'utf-8');

    return {
      ...artifact,
      uri: filePath,
    };
  }
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'unknown';
}

let runtimeArtifactStore: RuntimeArtifactStore | null = null;

export function getRuntimeArtifactStore(): RuntimeArtifactStore {
  if (!runtimeArtifactStore) {
    runtimeArtifactStore = new RuntimeArtifactStore();
  }
  return runtimeArtifactStore;
}

export function resetRuntimeArtifactStore(): void {
  runtimeArtifactStore = null;
}
