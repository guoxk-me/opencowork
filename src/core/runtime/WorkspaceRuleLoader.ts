import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceRuleSet {
  id: string;
  sourcePath: string;
  scopePath: string;
  content: string;
  loadedAt: number;
  warnings?: string[];
}

export interface WorkspaceRuleLoadResult {
  rules: WorkspaceRuleSet[];
  warnings: string[];
}

export interface WorkspaceRuleLoaderOptions {
  startDir?: string;
  fileName?: string;
  maxDepth?: number;
}

const DEFAULT_FILE_NAME = 'AGENTS.md';
const DEFAULT_MAX_DEPTH = 12;

export class WorkspaceRuleLoader {
  private readonly startDir: string;
  private readonly fileName: string;
  private readonly maxDepth: number;

  constructor(options: WorkspaceRuleLoaderOptions = {}) {
    this.startDir = options.startDir || process.cwd();
    this.fileName = options.fileName || DEFAULT_FILE_NAME;
    this.maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
  }

  load(): WorkspaceRuleLoadResult {
    const rules: WorkspaceRuleSet[] = [];
    const warnings: string[] = [];
    const visited = new Set<string>();
    let currentDir = path.resolve(this.startDir);

    for (let depth = 0; depth < this.maxDepth; depth++) {
      if (visited.has(currentDir)) {
        break;
      }
      visited.add(currentDir);

      const rulePath = path.join(currentDir, this.fileName);
      if (fs.existsSync(rulePath)) {
        try {
          const content = fs.readFileSync(rulePath, 'utf-8');
          rules.push({
            id: `${path.basename(currentDir) || 'root'}:${this.fileName}`,
            sourcePath: rulePath,
            scopePath: currentDir,
            content,
            loadedAt: Date.now(),
          });
        } catch (error) {
          warnings.push(`[WorkspaceRuleLoader] Failed to read ${rulePath}: ${String(error)}`);
        }
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return { rules, warnings };
  }
}

let workspaceRuleLoader: WorkspaceRuleLoader | null = null;

export function getWorkspaceRuleLoader(): WorkspaceRuleLoader {
  if (!workspaceRuleLoader) {
    workspaceRuleLoader = new WorkspaceRuleLoader();
  }
  return workspaceRuleLoader;
}

export function resetWorkspaceRuleLoader(): void {
  workspaceRuleLoader = null;
}
