import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { VmDesktopExecutionAdapter } from './DesktopExecutionAdapter';
import type { DesktopExecutionHarnessProvider } from './DesktopExecutionHarnessProvider';

export function createVmDesktopExecutionHarnessProvider(): DesktopExecutionHarnessProvider {
  return {
    kind: 'vm',
    supports: (target: ComputerExecutionTarget) => target.kind === 'desktop' && target.environment === 'vm',
    createAdapter: (browserExecutor: BrowserExecutor, target: ComputerExecutionTarget): ComputerExecutionAdapter =>
      new VmDesktopExecutionAdapter(browserExecutor),
  };
}
