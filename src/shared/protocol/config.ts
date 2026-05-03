import { ApprovalPolicyRule } from './approval';
import { RuntimeMode, RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';

export interface RuntimeConfig {
  version: RuntimeProtocolVersion;
  defaultMode: RuntimeMode;
  approvalPolicies: ApprovalPolicyRule[];
  traceRetentionDays: number;
  artifactRetentionDays: number;
  maxInlineOutputBytes: number;
  fileWatcher: {
    enabled: boolean;
    maxFileBytes: number;
    maxFiles: number;
  };
  logDirectory?: string;
  sqlitePath?: string;
  skillDirectories?: string[];
  visualProviderDefault?: string;
  mcp?: {
    defaultApprovalMode?: 'auto' | 'prompt' | 'deny';
    perToolApproval?: Record<string, 'auto' | 'prompt' | 'deny'>;
  };
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  version: RUNTIME_PROTOCOL_VERSION,
  defaultMode: 'execute',
  approvalPolicies: [],
  traceRetentionDays: 30,
  artifactRetentionDays: 30,
  maxInlineOutputBytes: 64 * 1024,
  fileWatcher: {
    enabled: true,
    maxFileBytes: 512 * 1024,
    maxFiles: 2000,
  },
};
