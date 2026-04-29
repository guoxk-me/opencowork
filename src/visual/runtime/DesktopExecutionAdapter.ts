import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { app, screen } from 'electron';
import { ComputerExecutionTarget, DesktopActionContract } from './ComputerExecutionAdapter';
import { PlaywrightBrowserExecutionAdapter } from './BrowserExecutionAdapter';
import { createContainerDesktopHarnessController, ContainerDesktopHarnessController } from './ContainerDesktopHarnessController';
import { createNativeBridgeDesktopHarnessController, NativeBridgeDesktopHarnessController } from './NativeBridgeDesktopHarnessController';
import { executeNativeBridgeDesktopActions, isNativeBridgeDesktopAction } from './NativeBridgeDesktopActionExecutor';
import { createVmDesktopHarnessController, VmDesktopHarnessController } from './VmDesktopHarnessController';
import { ActionExecutionResult, UIAction } from '../types/visualProtocol';

export type DesktopBackendRole = 'reference' | 'sandbox' | 'host' | 'fallback';

function createDesktopActionContract(providerId: string, backendRole: DesktopBackendRole): DesktopActionContract {
  const roleNotes: Record<DesktopBackendRole, string> = {
    reference: 'vm acts as the reference desktop backend used to stabilize product behavior and regression coverage.',
    sandbox: 'container acts as an isolated desktop sandbox for repeatable automation and benchmark runs.',
    host: 'native-bridge provides full host desktop access and must remain approval-aware for high-risk operations.',
    fallback: 'browser-backed fallback keeps the desktop contract visible when a dedicated backend is unavailable.',
  };

  return {
    supportedActions: [
      'open_application',
      'focus_window',
      'open_file',
      'save_file',
      'upload_file',
      'download_file',
    ],
    supportedOperations: ['application', 'window', 'file', 'transfer'],
    notes: [
      `desktop action contract for ${providerId}`,
      roleNotes[backendRole],
    ],
    workflowSemantics: [
      {
        action: 'open_application',
        summary: 'Launches a desktop application or opens a URI via the host shell.',
        examples: ['Open the notes app', 'Launch https://example.com in the default browser'],
      },
      {
        action: 'focus_window',
        summary: 'Brings the target window to the foreground for the next desktop step.',
        examples: ['Focus the Notes window', 'Return to the file picker dialog'],
      },
      {
        action: 'open_file',
        summary: 'Opens a local file or file chooser target and brings the user back to the desktop flow.',
        examples: ['Open /tmp/report.csv', 'Open the downloaded invoice'],
      },
      {
        action: 'save_file',
        summary: 'Persists the current working file to a local path or save target.',
        examples: ['Save the draft as /tmp/report.md', 'Save the export in Documents'],
      },
      {
        action: 'upload_file',
        summary: 'Reveals the upload target so the workflow can attach local files to an app or service.',
        examples: ['Upload the completed spreadsheet', 'Attach the screenshot to the support form'],
      },
      {
        action: 'download_file',
        summary: 'Reveals a downloaded artifact so the workflow can continue with local post-processing.',
        examples: ['Download the invoice PDF', 'Reveal the exported archive in Finder'],
      },
    ],
  };
}

function createNativeBridgeHostContext(): Record<string, unknown> {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const displays = screen.getAllDisplays();

    return {
      hostPlatform: process.platform,
      hostArch: process.arch,
      hostCwd: process.cwd(),
      hostUserDataPath: app.getPath('userData'),
      hostDisplayCount: displays.length,
      hostPrimaryDisplay: {
        bounds: primaryDisplay.bounds,
        workArea: primaryDisplay.workArea,
        scaleFactor: primaryDisplay.scaleFactor,
      },
      hostCapabilities: {
        openExternal: true,
        openPath: true,
        showItemInFolder: true,
      },
    };
  } catch (error) {
    console.warn('[NativeBridgeDesktopExecutionAdapter] Failed to inspect host context:', error);
    return {
      hostPlatform: process.platform,
      hostArch: process.arch,
      hostCwd: process.cwd(),
      hostUserDataPath: null,
      hostDisplayCount: null,
      hostPrimaryDisplay: null,
      hostCapabilities: {
        openExternal: true,
        openPath: true,
        showItemInFolder: true,
      },
    };
  }
}

function createContainerSandboxContext(): Record<string, unknown> {
  return {
    sandboxProfile: 'container-desktop-sandbox',
    sandboxIsolation: {
      filesystem: 'isolated',
      network: 'restricted',
      process: 'container-scoped',
      hostDesktopAccess: false,
    },
    sandboxCapabilities: {
      repeatableLaunch: true,
      boundedLifecycle: true,
      benchmarkFriendly: true,
      hostPathSharing: false,
    },
    sandboxLimits: {
      restartRequiredForStateReset: true,
      externalAppLaunch: false,
      hostWindowFocus: false,
    },
  };
}

export class TargetAwareDesktopExecutionAdapter extends PlaywrightBrowserExecutionAdapter {
  constructor(
    browserExecutor: BrowserExecutor,
    private readonly executionTarget: ComputerExecutionTarget,
    private readonly providerId: string,
    private readonly backendRole: DesktopBackendRole
  ) {
    super(browserExecutor);
  }

  override async getExecutionTarget(): Promise<ComputerExecutionTarget> {
    return this.executionTarget;
  }

  override async getExecutionContext(): Promise<Record<string, unknown>> {
    const browserContext = await super.getExecutionContext();
    return {
      ...browserContext,
      harness: 'desktop',
      harnessProvider: this.providerId,
      isolated: this.backendRole !== 'host',
      surface: 'desktop',
      executionEnvironment: this.executionTarget.environment,
      desktopBackendRole: this.backendRole,
    };
  }

  async getActionContract(): Promise<DesktopActionContract | null> {
    return createDesktopActionContract(this.providerId, this.backendRole);
  }

  async prepare(): Promise<void> {}

  async cleanup(): Promise<void> {}
}

export class VmDesktopExecutionAdapter extends TargetAwareDesktopExecutionAdapter {
  public prepared = false;
  public cleanedUp = false;
  public readonly harnessController: VmDesktopHarnessController;

  constructor(
    browserExecutor: BrowserExecutor,
    harnessController: VmDesktopHarnessController = createVmDesktopHarnessController()
  ) {
    super(
      browserExecutor,
      {
        kind: 'desktop',
        environment: 'vm',
      },
      'vm',
      'reference'
    );
    this.harnessController = harnessController;
  }

  override async prepare(): Promise<void> {
    await this.harnessController.launch();
    console.log('[VmDesktopExecutionAdapter] prepare VM desktop harness');
    this.prepared = true;
  }

  override async cleanup(): Promise<void> {
    await this.harnessController.shutdown();
    console.log('[VmDesktopExecutionAdapter] cleanup VM desktop harness');
    this.cleanedUp = true;
  }

  async restart(): Promise<void> {
    await this.harnessController.restart();
    this.prepared = true;
    this.cleanedUp = false;
  }

  override async getExecutionContext(): Promise<Record<string, unknown>> {
    const context = await super.getExecutionContext();
    return {
      ...context,
      harnessState: this.harnessController.snapshot(),
      desktopBackendRole: 'reference',
    };
  }

  async getActionContract(): Promise<DesktopActionContract | null> {
    return createDesktopActionContract('vm', 'reference');
  }
}

export class ContainerDesktopExecutionAdapter extends TargetAwareDesktopExecutionAdapter {
  public prepared = false;
  public cleanedUp = false;
  public readonly harnessController: ContainerDesktopHarnessController;

  constructor(
    browserExecutor: BrowserExecutor,
    harnessController: ContainerDesktopHarnessController = createContainerDesktopHarnessController()
  ) {
    super(
      browserExecutor,
      {
        kind: 'desktop',
        environment: 'container',
      },
      'container',
      'sandbox'
    );
    this.harnessController = harnessController;
  }

  override async prepare(): Promise<void> {
    await this.harnessController.launch();
    console.log('[ContainerDesktopExecutionAdapter] prepare desktop harness skeleton');
    this.prepared = true;
  }

  override async cleanup(): Promise<void> {
    await this.harnessController.shutdown();
    console.log('[ContainerDesktopExecutionAdapter] cleanup desktop harness skeleton');
    this.cleanedUp = true;
  }

  async restart(): Promise<void> {
    await this.harnessController.restart();
    this.prepared = true;
    this.cleanedUp = false;
  }

  override async getExecutionContext(): Promise<Record<string, unknown>> {
    const context = await super.getExecutionContext();
    return {
      ...context,
      harnessState: this.harnessController.snapshot(),
      desktopBackendRole: 'sandbox',
      sandboxContext: createContainerSandboxContext(),
    };
  }

  async getActionContract(): Promise<DesktopActionContract | null> {
    return createDesktopActionContract('container', 'sandbox');
  }
}

export class NativeBridgeDesktopExecutionAdapter extends TargetAwareDesktopExecutionAdapter {
  public prepared = false;
  public cleanedUp = false;
  public readonly harnessController: NativeBridgeDesktopHarnessController;

  constructor(
    browserExecutor: BrowserExecutor,
    harnessController: NativeBridgeDesktopHarnessController = createNativeBridgeDesktopHarnessController()
  ) {
    super(
      browserExecutor,
      {
        kind: 'desktop',
        environment: 'native-bridge',
      },
      'native-bridge',
      'host'
    );
    this.harnessController = harnessController;
  }

  override async prepare(): Promise<void> {
    await this.harnessController.launch();
    console.log('[NativeBridgeDesktopExecutionAdapter] prepare desktop harness skeleton');
    this.prepared = true;
  }

  override async cleanup(): Promise<void> {
    await this.harnessController.shutdown();
    console.log('[NativeBridgeDesktopExecutionAdapter] cleanup desktop harness skeleton');
    this.cleanedUp = true;
  }

  async restart(): Promise<void> {
    await this.harnessController.restart();
    this.prepared = true;
    this.cleanedUp = false;
  }

  override async executeActions(actions: UIAction[]): Promise<ActionExecutionResult> {
    const executed: UIAction[] = [];

    for (const action of actions) {
      if (isNativeBridgeDesktopAction(action)) {
        const result = await executeNativeBridgeDesktopActions([action]);
        executed.push(...result.executed);

        if (!result.success) {
          return {
            success: false,
            executed,
            error: result.error,
          };
        }

        continue;
      }

      const browserResult = await super.executeActions([action]);
      executed.push(...browserResult.executed);

      if (!browserResult.success) {
        return {
          success: false,
          executed,
          error: browserResult.error,
        };
      }
    }

    return {
      success: true,
      executed,
    };
  }

  override async getExecutionContext(): Promise<Record<string, unknown>> {
    const context = await super.getExecutionContext();
    return {
      ...context,
      harnessState: this.harnessController.snapshot(),
      desktopBackendRole: 'host',
      hostContext: createNativeBridgeHostContext(),
    };
  }

  async getActionContract(): Promise<DesktopActionContract | null> {
    return createDesktopActionContract('native-bridge', 'host');
  }
}

export class BrowserBackedDesktopExecutionAdapter extends TargetAwareDesktopExecutionAdapter {
  constructor(browserExecutor: BrowserExecutor) {
    super(
      browserExecutor,
      {
        kind: 'desktop',
        environment: 'vm',
      },
      'browser-backed-vm',
      'fallback'
    );
  }
}
