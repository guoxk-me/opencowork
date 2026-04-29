import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { NativeBridgeDesktopExecutionAdapter } from './DesktopExecutionAdapter';
import type { DesktopExecutionHarnessProvider } from './DesktopExecutionHarnessProvider';

export function createNativeBridgeDesktopExecutionHarnessProvider(): DesktopExecutionHarnessProvider {
  return {
    kind: 'native-bridge',
    supports: (target: ComputerExecutionTarget) => target.kind === 'desktop' && target.environment === 'native-bridge',
    createAdapter: (browserExecutor: BrowserExecutor, target: ComputerExecutionTarget): ComputerExecutionAdapter =>
      new NativeBridgeDesktopExecutionAdapter(browserExecutor),
  };
}
