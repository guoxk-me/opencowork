import {
  createDesktopHarnessCommandHooks,
  DesktopHarnessCommandSpec,
  DesktopHarnessHooks,
  DesktopHarnessSnapshot,
  parseDesktopHarnessCommandSpec,
  SerializedDesktopHarnessControllerBase,
} from './DesktopHarnessControllerBase';

export type ContainerDesktopHarnessStatus = DesktopHarnessSnapshot['status'];
export type ContainerDesktopHarnessHooks = DesktopHarnessHooks;
export interface ContainerDesktopHarnessSnapshot extends DesktopHarnessSnapshot {}

export interface ContainerDesktopHarnessControllerOptions {
  onLaunch?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
}

export function createContainerDesktopHarnessCommandHooks(
  launchCommand: DesktopHarnessCommandSpec | null | undefined,
  shutdownCommand: DesktopHarnessCommandSpec | null | undefined
): ContainerDesktopHarnessHooks {
  return createDesktopHarnessCommandHooks(launchCommand, shutdownCommand, 'ContainerDesktopHarnessController');
}

export function createContainerDesktopHarnessControllerOptionsFromEnv(): ContainerDesktopHarnessControllerOptions {
  const launchCommand = parseDesktopHarnessCommandSpec(
    process.env.OPENCOWORK_CONTAINER_LAUNCH_COMMAND_JSON,
    'ContainerDesktopHarnessController'
  );
  const shutdownCommand = parseDesktopHarnessCommandSpec(
    process.env.OPENCOWORK_CONTAINER_SHUTDOWN_COMMAND_JSON,
    'ContainerDesktopHarnessController'
  );
  const hooks = createContainerDesktopHarnessCommandHooks(launchCommand, shutdownCommand);

  return {
    onLaunch: hooks.onLaunch,
    onShutdown: hooks.onShutdown,
  };
}

export class ContainerDesktopHarnessController extends SerializedDesktopHarnessControllerBase {
  constructor(private readonly containerHooks: ContainerDesktopHarnessHooks = {}) {
    super(containerHooks);
  }

  async launch(): Promise<void> {
    await this.launchSerialized('ContainerDesktopHarnessController');
  }

  async shutdown(): Promise<void> {
    await this.shutdownSerialized('ContainerDesktopHarnessController');
  }

  async restart(): Promise<void> {
    await this.shutdown();
    await this.launch();
  }

  snapshot(): ContainerDesktopHarnessSnapshot {
    return {
      ...this.createSnapshotBase(),
    };
  }
}

export function createContainerDesktopHarnessController(
  options: ContainerDesktopHarnessControllerOptions = createContainerDesktopHarnessControllerOptionsFromEnv()
): ContainerDesktopHarnessController {
  return new ContainerDesktopHarnessController({
    onLaunch: options.onLaunch,
    onShutdown: options.onShutdown,
  });
}
