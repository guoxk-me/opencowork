import {
  createDesktopHarnessCommandHooks,
  DesktopHarnessCommandSpec,
  DesktopHarnessHooks,
  DesktopHarnessSnapshot,
  parseDesktopHarnessCommandSpec,
  SerializedDesktopHarnessControllerBase,
} from './DesktopHarnessControllerBase';

export type NativeBridgeDesktopHarnessStatus = DesktopHarnessSnapshot['status'];
export type NativeBridgeDesktopHarnessHooks = DesktopHarnessHooks;
export interface NativeBridgeDesktopHarnessSnapshot extends DesktopHarnessSnapshot {}

export interface NativeBridgeDesktopHarnessControllerOptions {
  onLaunch?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
}

export function createNativeBridgeDesktopHarnessCommandHooks(
  launchCommand: DesktopHarnessCommandSpec | null | undefined,
  shutdownCommand: DesktopHarnessCommandSpec | null | undefined
): NativeBridgeDesktopHarnessHooks {
  return createDesktopHarnessCommandHooks(launchCommand, shutdownCommand, 'NativeBridgeDesktopHarnessController');
}

export function createNativeBridgeDesktopHarnessControllerOptionsFromEnv(): NativeBridgeDesktopHarnessControllerOptions {
  const launchCommand = parseDesktopHarnessCommandSpec(
    process.env.OPENCOWORK_NATIVE_BRIDGE_LAUNCH_COMMAND_JSON,
    'NativeBridgeDesktopHarnessController'
  );
  const shutdownCommand = parseDesktopHarnessCommandSpec(
    process.env.OPENCOWORK_NATIVE_BRIDGE_SHUTDOWN_COMMAND_JSON,
    'NativeBridgeDesktopHarnessController'
  );
  const hooks = createNativeBridgeDesktopHarnessCommandHooks(launchCommand, shutdownCommand);

  return {
    onLaunch: hooks.onLaunch,
    onShutdown: hooks.onShutdown,
  };
}

export class NativeBridgeDesktopHarnessController extends SerializedDesktopHarnessControllerBase {
  constructor(private readonly nativeBridgeHooks: NativeBridgeDesktopHarnessHooks = {}) {
    super(nativeBridgeHooks);
  }

  async launch(): Promise<void> {
    await this.launchSerialized('NativeBridgeDesktopHarnessController');
  }

  async shutdown(): Promise<void> {
    await this.shutdownSerialized('NativeBridgeDesktopHarnessController');
  }

  async restart(): Promise<void> {
    await this.shutdown();
    await this.launch();
  }

  snapshot(): NativeBridgeDesktopHarnessSnapshot {
    return {
      ...this.createSnapshotBase(),
    };
  }
}

export function createNativeBridgeDesktopHarnessController(
  options: NativeBridgeDesktopHarnessControllerOptions = createNativeBridgeDesktopHarnessControllerOptionsFromEnv()
): NativeBridgeDesktopHarnessController {
  return new NativeBridgeDesktopHarnessController({
    onLaunch: options.onLaunch,
    onShutdown: options.onShutdown,
  });
}
