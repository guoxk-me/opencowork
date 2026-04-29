import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserExecutor } from '../../../core/executor/BrowserExecutor';
import { createBrowserBackedDesktopExecutionHarnessProvider } from '../BrowserBackedDesktopExecutionHarnessProvider';
import { createContainerDesktopExecutionHarnessProvider } from '../ContainerDesktopExecutionHarnessProvider';
import {
  BrowserBackedDesktopExecutionAdapter,
  ContainerDesktopExecutionAdapter,
  NativeBridgeDesktopExecutionAdapter,
  VmDesktopExecutionAdapter,
} from '../DesktopExecutionAdapter';
import { createContainerDesktopHarnessController } from '../ContainerDesktopHarnessController';
import { createNativeBridgeDesktopHarnessController } from '../NativeBridgeDesktopHarnessController';
import { createVmDesktopHarnessController } from '../VmDesktopHarnessController';
import { createVmDesktopHarnessControllerOptionsFromEnv } from '../VmDesktopHarnessController';
import { createNativeBridgeDesktopExecutionHarnessProvider } from '../NativeBridgeDesktopExecutionHarnessProvider';
import { createVmDesktopExecutionHarnessProvider } from '../VmDesktopExecutionHarnessProvider';
import { resolveDesktopExecutionHarnessProvider } from '../DesktopExecutionHarnessProvider';

const childProcessMocks = vi.hoisted(() => ({
  execFile: vi.fn((command: string, args: string[] | undefined, options: Record<string, unknown> | undefined, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    callback(null, '', '');
  }),
}));

const electronMocks = vi.hoisted(() => {
  const focusWindow = {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    getTitle: vi.fn(() => 'Native Bridge Demo'),
  };

  return {
    focusWindow,
    shell: {
      openPath: vi.fn(async () => ''),
      openExternal: vi.fn(async () => undefined),
      showItemInFolder: vi.fn(),
    },
    getAllWindows: vi.fn(() => [focusWindow]),
    app: {
      getPath: vi.fn(() => '/tmp/opencowork-user-data'),
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
      })),
      getAllDisplays: vi.fn(() => [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 0, width: 1920, height: 1040 },
          scaleFactor: 1,
        },
      ]),
    },
  };
});

vi.mock('electron', () => ({
  shell: electronMocks.shell,
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  app: electronMocks.app,
  screen: electronMocks.screen,
}));

vi.mock('child_process', () => ({
  execFile: childProcessMocks.execFile,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  childProcessMocks.execFile.mockClear();
});

function createBrowserExecutorStub(): BrowserExecutor {
  return {
    getPage: () => ({
      title: async () => 'Desktop Harness',
    }),
    getScreenshot: async () => 'screenshot',
    getPageUrl: async () => 'https://example.test/desktop',
    getPageContent: async () => '<main>Desktop harness</main>',
    getPageStructure: async () => ({ containers: [] }),
  } as unknown as BrowserExecutor;
}

describe('DesktopExecutionHarnessProvider', () => {
  it('exposes explicit provider kinds', () => {
    expect(createVmDesktopExecutionHarnessProvider().kind).toBe('vm');
    expect(createContainerDesktopExecutionHarnessProvider().kind).toBe('container');
    expect(createNativeBridgeDesktopExecutionHarnessProvider().kind).toBe('native-bridge');
    expect(createBrowserBackedDesktopExecutionHarnessProvider().kind).toBe('browser-backed');
  });

  it('selects the vm provider for vm desktop targets', () => {
    const provider = resolveDesktopExecutionHarnessProvider({
      kind: 'desktop',
      environment: 'vm',
    });

    expect(provider.kind).toBe('vm');
    expect(provider.createAdapter(createBrowserExecutorStub(), { kind: 'desktop', environment: 'vm' })).toBeInstanceOf(
      VmDesktopExecutionAdapter
    );
  });

  it('tracks lifecycle state on explicit vm adapters', async () => {
    const adapter = new VmDesktopExecutionAdapter(createBrowserExecutorStub());
    expect(adapter.prepared).toBe(false);
    expect(adapter.cleanedUp).toBe(false);

    await adapter.prepare?.();
    expect(adapter.harnessController.snapshot().status).toBe('running');
    expect(await adapter.getExecutionContext()).toMatchObject({
      harness: 'desktop',
      harnessProvider: 'vm',
      desktopBackendRole: 'reference',
      executionEnvironment: 'vm',
      harnessState: {
        status: 'running',
        launchCount: 1,
        shutdownCount: 0,
      },
    });
    expect(await adapter.getActionContract()).toMatchObject({
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
      supportedOperations: ['application', 'window', 'file', 'transfer'],
    });
    await adapter.cleanup?.();

    expect(adapter.prepared).toBe(true);
    expect(adapter.cleanedUp).toBe(true);
    expect(adapter.harnessController.snapshot().status).toBe('stopped');
  });

  it('allows injecting launch and shutdown hooks into the vm controller', async () => {
    const events: string[] = [];
    const controller = createVmDesktopHarnessController({
      onLaunch: async () => {
        events.push('launch');
      },
      onShutdown: async () => {
        events.push('shutdown');
      },
    });

    await controller.launch();
    await controller.shutdown();

    expect(events).toEqual(['launch', 'shutdown']);
    expect(controller.snapshot()).toMatchObject({
      status: 'stopped',
      launchCount: 1,
      shutdownCount: 1,
      hasLaunchHook: true,
      hasShutdownHook: true,
    });
  });

  it('serializes repeated vm launches without double-starting', async () => {
    let launchCalls = 0;
    const controller = createVmDesktopHarnessController({
      onLaunch: async () => {
        launchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
    });

    await Promise.all([controller.launch(), controller.launch(), controller.launch()]);

    expect(launchCalls).toBe(1);
    expect(controller.snapshot()).toMatchObject({
      status: 'running',
      launchCount: 1,
    });
  });

  it('restarts vm controllers through a full shutdown and relaunch cycle', async () => {
    const events: string[] = [];
    const controller = createVmDesktopHarnessController({
      onLaunch: async () => {
        events.push('launch');
      },
      onShutdown: async () => {
        events.push('shutdown');
      },
    });

    await controller.launch();
    await controller.restart();

    expect(events).toEqual(['launch', 'shutdown', 'launch']);
    expect(controller.snapshot()).toMatchObject({
      status: 'running',
      launchCount: 2,
      shutdownCount: 1,
    });
  });

  it('wires vm launch and shutdown hooks from env command specs', async () => {
    vi.stubEnv('OPENCOWORK_VM_LAUNCH_COMMAND_JSON', JSON.stringify({
      command: 'vm-launch',
      args: ['--fresh'],
      cwd: '/tmp/vm-home',
      env: { VM_MODE: 'test' },
    }));
    vi.stubEnv('OPENCOWORK_VM_SHUTDOWN_COMMAND_JSON', JSON.stringify({
      command: 'vm-shutdown',
      args: ['--graceful'],
    }));

    const options = createVmDesktopHarnessControllerOptionsFromEnv();
    const controller = createVmDesktopHarnessController(options);

    await controller.launch();
    await controller.shutdown();

    expect(childProcessMocks.execFile).toHaveBeenCalledWith(
      'vm-launch',
      ['--fresh'],
      expect.objectContaining({
        cwd: '/tmp/vm-home',
        env: expect.objectContaining({ VM_MODE: 'test' }),
      }),
      expect.any(Function)
    );
    expect(childProcessMocks.execFile).toHaveBeenCalledWith(
      'vm-shutdown',
      ['--graceful'],
      expect.objectContaining({
        cwd: undefined,
      }),
      expect.any(Function)
    );
    expect(controller.snapshot()).toMatchObject({
      status: 'stopped',
      launchCount: 1,
      shutdownCount: 1,
      hasLaunchHook: true,
      hasShutdownHook: true,
    });
  });

  it('selects the container provider for container desktop targets', () => {
    const provider = resolveDesktopExecutionHarnessProvider({
      kind: 'desktop',
      environment: 'container',
    });

    expect(provider.kind).toBe('container');
    expect(
      provider.createAdapter(createBrowserExecutorStub(), { kind: 'desktop', environment: 'container' })
    ).toBeInstanceOf(ContainerDesktopExecutionAdapter);
  });

  it('tracks lifecycle state on explicit container adapters', async () => {
    const adapter = new ContainerDesktopExecutionAdapter(createBrowserExecutorStub());
    await adapter.prepare?.();
    await adapter.cleanup?.();

    expect(adapter.prepared).toBe(true);
    expect(adapter.cleanedUp).toBe(true);
    expect(await adapter.getExecutionContext()).toMatchObject({
      harness: 'desktop',
      harnessProvider: 'container',
      desktopBackendRole: 'sandbox',
      sandboxContext: {
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
      },
    });
    expect(await adapter.getActionContract()).toMatchObject({
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
      supportedOperations: ['application', 'window', 'file', 'transfer'],
    });
  });

  it('serializes repeated container launches without double-starting', async () => {
    let launchCalls = 0;
    const controller = createContainerDesktopHarnessController({
      onLaunch: async () => {
        launchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
    });

    await Promise.all([controller.launch(), controller.launch(), controller.launch()]);

    expect(launchCalls).toBe(1);
    expect(controller.snapshot()).toMatchObject({
      status: 'running',
      launchCount: 1,
      hasLaunchHook: true,
      hasShutdownHook: false,
    });
  });

  it('keeps execution context tagged with the harness provider', async () => {
    const provider = resolveDesktopExecutionHarnessProvider({
      kind: 'desktop',
      environment: 'native-bridge',
    });
    const adapter = provider.createAdapter(createBrowserExecutorStub(), {
      kind: 'desktop',
      environment: 'native-bridge',
    });

    expect(await adapter.getExecutionTarget()).toEqual({
      kind: 'desktop',
      environment: 'native-bridge',
    });

    const context = await adapter.getExecutionContext();

    expect(context.harness).toBe('desktop');
    expect(context.harnessProvider).toBe('native-bridge');
    expect(context.isolated).toBe(false);
    expect(context.surface).toBe('desktop');
    expect(context.executionEnvironment).toBe('native-bridge');
    expect(context.desktopBackendRole).toBe('host');

    const hostContext = context.hostContext as Record<string, unknown> | undefined;
    expect(hostContext).toBeTruthy();
    expect(typeof hostContext?.hostPlatform).toBe('string');
    expect(typeof hostContext?.hostArch).toBe('string');
    expect(typeof hostContext?.hostCwd).toBe('string');
    expect(hostContext?.hostCapabilities).toMatchObject({
      openExternal: true,
      openPath: true,
      showItemInFolder: true,
    });
    expect(await adapter.getActionContract()).toMatchObject({
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
      supportedOperations: ['application', 'window', 'file', 'transfer'],
    });
    expect(adapter).toBeInstanceOf(NativeBridgeDesktopExecutionAdapter);
  });

  it('tracks lifecycle state on explicit native bridge adapters', async () => {
    const adapter = new NativeBridgeDesktopExecutionAdapter(createBrowserExecutorStub());
    await adapter.prepare?.();
    await adapter.cleanup?.();

    expect(adapter.prepared).toBe(true);
    expect(adapter.cleanedUp).toBe(true);
    expect(await adapter.getActionContract()).toMatchObject({
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
      supportedOperations: ['application', 'window', 'file', 'transfer'],
    });
    expect(adapter.harnessController.snapshot()).toMatchObject({
      status: 'stopped',
      hasLaunchHook: false,
      hasShutdownHook: false,
    });
  });

  it('serializes repeated native bridge launches without double-starting', async () => {
    let launchCalls = 0;
    const controller = createNativeBridgeDesktopHarnessController({
      onLaunch: async () => {
        launchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
    });

    await Promise.all([controller.launch(), controller.launch(), controller.launch()]);

    expect(launchCalls).toBe(1);
    expect(controller.snapshot()).toMatchObject({
      status: 'running',
      launchCount: 1,
      hasLaunchHook: true,
      hasShutdownHook: false,
    });
  });

  it('uses browser-backed adapter as the default fallback provider', () => {
    const provider = createBrowserBackedDesktopExecutionHarnessProvider();
    const adapter = provider.createAdapter(createBrowserExecutorStub(), {
      kind: 'desktop',
      environment: 'vm',
    });

    expect(provider.kind).toBe('browser-backed');
    expect(adapter).toBeInstanceOf(BrowserBackedDesktopExecutionAdapter);
  });
});
