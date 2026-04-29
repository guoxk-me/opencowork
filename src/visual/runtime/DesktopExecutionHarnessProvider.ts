import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { ComputerExecutionAdapter, ComputerExecutionTarget } from './ComputerExecutionAdapter';
import { BrowserBackedDesktopExecutionAdapter } from './DesktopExecutionAdapter';
import { createBrowserBackedDesktopExecutionHarnessProvider } from './BrowserBackedDesktopExecutionHarnessProvider';
import { createContainerDesktopExecutionHarnessProvider } from './ContainerDesktopExecutionHarnessProvider';
import { createNativeBridgeDesktopExecutionHarnessProvider } from './NativeBridgeDesktopExecutionHarnessProvider';
import { createVmDesktopExecutionHarnessProvider } from './VmDesktopExecutionHarnessProvider';

export type DesktopExecutionHarnessProviderKind = 'browser-backed' | 'vm' | 'container' | 'native-bridge';

export interface DesktopExecutionHarnessProvider {
  kind: DesktopExecutionHarnessProviderKind;
  supports(target: ComputerExecutionTarget): boolean;
  createAdapter(browserExecutor: BrowserExecutor, target: ComputerExecutionTarget): ComputerExecutionAdapter;
}

export function createDefaultDesktopExecutionHarnessProviders(): DesktopExecutionHarnessProvider[] {
  return [
    createVmDesktopExecutionHarnessProvider(),
    createContainerDesktopExecutionHarnessProvider(),
    createNativeBridgeDesktopExecutionHarnessProvider(),
    createBrowserBackedDesktopExecutionHarnessProvider(),
  ];
}

export function resolveDesktopExecutionHarnessProvider(
  target: ComputerExecutionTarget,
  providers: DesktopExecutionHarnessProvider[] = createDefaultDesktopExecutionHarnessProviders()
): DesktopExecutionHarnessProvider {
  const matchedProvider = providers.find((provider) => provider.supports(target));
  if (matchedProvider) {
    return matchedProvider;
  }

  const browserBackedProvider = providers.find((provider) => provider.kind === 'browser-backed');
  if (browserBackedProvider) {
    return browserBackedProvider;
  }

  return providers[0] || {
    kind: 'browser-backed',
    supports: () => true,
    createAdapter: (browserExecutor) => new BrowserBackedDesktopExecutionAdapter(browserExecutor),
  };
}

export function createBrowserBackedDesktopExecutionAdapter(browserExecutor: BrowserExecutor): ComputerExecutionAdapter {
  return new BrowserBackedDesktopExecutionAdapter(browserExecutor);
}
