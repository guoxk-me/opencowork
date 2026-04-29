import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { BrowserBackedDesktopExecutionAdapter } from './DesktopExecutionAdapter';
import type { DesktopExecutionHarnessProvider } from './DesktopExecutionHarnessProvider';

export function createBrowserBackedDesktopExecutionHarnessProvider(): DesktopExecutionHarnessProvider {
  return {
    kind: 'browser-backed',
    supports: (_target: ComputerExecutionTarget) => true,
    createAdapter: (browserExecutor: BrowserExecutor, _target: ComputerExecutionTarget): ComputerExecutionAdapter =>
      new BrowserBackedDesktopExecutionAdapter(browserExecutor),
  };
}
