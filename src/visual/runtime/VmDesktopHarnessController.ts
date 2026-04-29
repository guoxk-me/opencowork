import {
  createDesktopHarnessCommandHooks,
  DesktopHarnessCommandSpec,
  DesktopHarnessHooks,
  DesktopHarnessSnapshot,
  parseDesktopHarnessCommandSpec,
  SerializedDesktopHarnessControllerBase,
} from './DesktopHarnessControllerBase';

export type VmDesktopHarnessStatus = DesktopHarnessSnapshot['status'];
export type VmDesktopHarnessHooks = DesktopHarnessHooks;
export interface VmDesktopHarnessSnapshot extends DesktopHarnessSnapshot {}

export interface VmDesktopHarnessControllerOptions {
  onLaunch?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
}

export function createVmDesktopHarnessCommandHooks(
  launchCommand: DesktopHarnessCommandSpec | null | undefined,
  shutdownCommand: DesktopHarnessCommandSpec | null | undefined
): VmDesktopHarnessHooks {
  return createDesktopHarnessCommandHooks(launchCommand, shutdownCommand, 'VmDesktopHarnessController');
}

export function createVmDesktopHarnessControllerOptionsFromEnv(): VmDesktopHarnessControllerOptions {
  const launchCommand = parseDesktopHarnessCommandSpec(process.env.OPENCOWORK_VM_LAUNCH_COMMAND_JSON, 'VmDesktopHarnessController');
  const shutdownCommand = parseDesktopHarnessCommandSpec(
    process.env.OPENCOWORK_VM_SHUTDOWN_COMMAND_JSON,
    'VmDesktopHarnessController'
  );
  const hooks = createVmDesktopHarnessCommandHooks(launchCommand, shutdownCommand);

  return {
    onLaunch: hooks.onLaunch,
    onShutdown: hooks.onShutdown,
  };
}

export class VmDesktopHarnessController extends SerializedDesktopHarnessControllerBase {
  constructor(private readonly vmHooks: VmDesktopHarnessHooks = {}) {
    super(vmHooks);
  }

  async launch(): Promise<void> {
    await this.launchSerialized('VmDesktopHarnessController');
  }

  async shutdown(): Promise<void> {
    await this.shutdownSerialized('VmDesktopHarnessController');
  }

  async restart(): Promise<void> {
    await this.shutdown();
    await this.launch();
  }

  snapshot(): VmDesktopHarnessSnapshot {
    return {
      ...this.createSnapshotBase(),
    };
  }
}

export function createVmDesktopHarnessController(
  options: VmDesktopHarnessControllerOptions = createVmDesktopHarnessControllerOptionsFromEnv()
): VmDesktopHarnessController {
  return new VmDesktopHarnessController({
    onLaunch: options.onLaunch,
    onShutdown: options.onShutdown,
  });
}
