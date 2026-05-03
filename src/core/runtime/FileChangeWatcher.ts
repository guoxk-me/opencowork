import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuntimeArtifact } from '../../shared/protocol';
import { RuntimeArtifactStore, getRuntimeArtifactStore } from './RuntimeArtifactStore';

interface FileSnapshotEntry {
  relativePath: string;
  sizeBytes: number;
  mtimeMs: number;
  hash: string;
  content?: string;
}

export interface FileChangeSummary {
  rootDir: string;
  added: string[];
  modified: string[];
  deleted: string[];
  scannedFiles: number;
  skippedFiles: number;
  artifacts: RuntimeArtifact[];
}

export interface FileChangeWatcherOptions {
  rootDir?: string;
  maxFileBytes?: number;
  maxFiles?: number;
  artifactStore?: RuntimeArtifactStore;
}

const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_FILES = 2000;
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.vite',
  '.turbo',
  'backup',
]);

export class FileChangeWatcher {
  private readonly rootDir: string;
  private readonly maxFileBytes: number;
  private readonly maxFiles: number;
  private readonly artifactStore: RuntimeArtifactStore;
  private snapshot = new Map<string, FileSnapshotEntry>();

  constructor(options: FileChangeWatcherOptions = {}) {
    this.rootDir = path.resolve(options.rootDir || process.cwd());
    this.maxFileBytes = options.maxFileBytes || DEFAULT_MAX_FILE_BYTES;
    this.maxFiles = options.maxFiles || DEFAULT_MAX_FILES;
    this.artifactStore = options.artifactStore || getRuntimeArtifactStore();
  }

  captureBaseline(): void {
    this.snapshot = this.captureSnapshot();
  }

  collectChanges(runId: string): FileChangeSummary {
    const nextSnapshot = this.captureSnapshot();
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const [relativePath, entry] of nextSnapshot) {
      const previous = this.snapshot.get(relativePath);
      if (!previous) {
        added.push(relativePath);
      } else if (previous.hash !== entry.hash) {
        modified.push(relativePath);
      }
    }

    for (const relativePath of this.snapshot.keys()) {
      if (!nextSnapshot.has(relativePath)) {
        deleted.push(relativePath);
      }
    }

    const diff = this.buildDiff({ added, modified, deleted, nextSnapshot });
    const artifacts = diff.trim()
      ? [
          this.artifactStore.saveTextArtifact({
            runId,
            kind: 'diff',
            title: 'Workspace file changes',
            content: diff,
            extension: 'diff',
            mimeType: 'text/x-diff',
            metadata: {
              rootDir: this.rootDir,
              addedCount: added.length,
              modifiedCount: modified.length,
              deletedCount: deleted.length,
            },
          }),
        ]
      : [];

    this.snapshot = nextSnapshot;

    return {
      rootDir: this.rootDir,
      added,
      modified,
      deleted,
      scannedFiles: nextSnapshot.size,
      skippedFiles: 0,
      artifacts,
    };
  }

  private captureSnapshot(): Map<string, FileSnapshotEntry> {
    const entries = new Map<string, FileSnapshotEntry>();
    let scanned = 0;

    const visit = (dir: string): void => {
      if (scanned >= this.maxFiles) {
        return;
      }

      let dirents: fs.Dirent[];
      try {
        dirents = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const dirent of dirents) {
        if (scanned >= this.maxFiles) {
          return;
        }
        if (dirent.name.startsWith('.') && dirent.name !== '.env.example') {
          continue;
        }

        const absolutePath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          if (!IGNORED_DIRS.has(dirent.name)) {
            visit(absolutePath);
          }
          continue;
        }

        if (!dirent.isFile()) {
          continue;
        }

        const entry = this.readEntry(absolutePath);
        if (entry) {
          entries.set(entry.relativePath, entry);
          scanned += 1;
        }
      }
    };

    visit(this.rootDir);
    return entries;
  }

  private readEntry(absolutePath: string): FileSnapshotEntry | null {
    try {
      const stat = fs.statSync(absolutePath);
      const relativePath = path.relative(this.rootDir, absolutePath).split(path.sep).join('/');
      if (stat.size > this.maxFileBytes) {
        return {
          relativePath,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
          hash: `${stat.size}:${stat.mtimeMs}`,
        };
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      if (content.includes('\u0000')) {
        return {
          relativePath,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
          hash: `${stat.size}:${stat.mtimeMs}`,
        };
      }

      return {
        relativePath,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        content,
      };
    } catch {
      return null;
    }
  }

  private buildDiff(params: {
    added: string[];
    modified: string[];
    deleted: string[];
    nextSnapshot: Map<string, FileSnapshotEntry>;
  }): string {
    const sections: string[] = [];
    const appendFile = (label: string, relativePath: string, content?: string): void => {
      sections.push(`${label} ${relativePath}`);
      if (content !== undefined) {
        sections.push(...content.split(/\r?\n/).map((line) => `+${line}`));
      }
    };

    for (const relativePath of params.added) {
      appendFile('+++', relativePath, params.nextSnapshot.get(relativePath)?.content);
    }

    for (const relativePath of params.modified) {
      const before = this.snapshot.get(relativePath)?.content;
      const after = params.nextSnapshot.get(relativePath)?.content;
      sections.push(`--- ${relativePath}`);
      sections.push(`+++ ${relativePath}`);
      if (before !== undefined && after !== undefined) {
        sections.push(...createSimpleLineDiff(before, after));
      } else {
        sections.push('~ binary or oversized file changed');
      }
    }

    for (const relativePath of params.deleted) {
      const before = this.snapshot.get(relativePath)?.content;
      sections.push(`--- ${relativePath}`);
      if (before !== undefined) {
        sections.push(...before.split(/\r?\n/).map((line) => `-${line}`));
      }
    }

    return sections.join(os.EOL);
  }
}

function createSimpleLineDiff(before: string, after: string): string[] {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const diff: string[] = [];

  for (let index = 0; index < max; index += 1) {
    if (beforeLines[index] === afterLines[index]) {
      diff.push(` ${beforeLines[index] || ''}`);
      continue;
    }
    if (beforeLines[index] !== undefined) {
      diff.push(`-${beforeLines[index]}`);
    }
    if (afterLines[index] !== undefined) {
      diff.push(`+${afterLines[index]}`);
    }
  }

  return diff;
}
