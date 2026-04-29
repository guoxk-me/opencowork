import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { ContainerDesktopExecutionAdapter } from './DesktopExecutionAdapter';
import type { DesktopExecutionHarnessProvider } from './DesktopExecutionHarnessProvider';

export function createContainerDesktopExecutionHarnessProvider(): DesktopExecutionHarnessProvider {
  return {
    kind: 'container',
    supports: (target: ComputerExecutionTarget) => target.kind === 'desktop' && target.environment === 'container',
    createAdapter: (browserExecutor: BrowserExecutor, target: ComputerExecutionTarget): ComputerExecutionAdapter =>
      new ContainerDesktopExecutionAdapter(browserExecutor),
  };
}
