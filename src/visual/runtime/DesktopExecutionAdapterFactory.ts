import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { createBrowserBackedDesktopExecutionAdapter, resolveDesktopExecutionHarnessProvider } from './DesktopExecutionHarnessProvider';

export type DesktopExecutionAdapterFactory = (
  browserExecutor: BrowserExecutor,
  executionTarget?: ComputerExecutionTarget | null
) => ComputerExecutionAdapter;

export function createDefaultDesktopExecutionAdapterFactory(): DesktopExecutionAdapterFactory {
  return (browserExecutor: BrowserExecutor, executionTarget?: ComputerExecutionTarget | null) => {
    if (executionTarget?.kind === 'desktop') {
      const provider = resolveDesktopExecutionHarnessProvider(executionTarget);
      return provider.createAdapter(browserExecutor, executionTarget);
    }

    return createBrowserBackedDesktopExecutionAdapter(browserExecutor);
  };
}
