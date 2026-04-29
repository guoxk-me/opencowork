import { describe, expect, it, vi } from 'vitest';

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

import { executeNativeBridgeDesktopActions } from '../NativeBridgeDesktopActionExecutor';

describe('NativeBridgeDesktopActionExecutor', () => {
  it('executes native bridge file and focus actions', async () => {
    const result = await executeNativeBridgeDesktopActions([
      { type: 'focus_window', windowTitle: 'demo' },
      { type: 'open_file', targetPath: '/tmp/native-bridge-demo.txt' },
      { type: 'download_file', targetPath: '/tmp/native-bridge-download.txt' },
    ]);

    expect(result.success).toBe(true);
    expect(result.executed).toHaveLength(3);
    expect(electronMocks.focusWindow.show).toHaveBeenCalled();
    expect(electronMocks.focusWindow.focus).toHaveBeenCalled();
    expect(electronMocks.shell.openPath).toHaveBeenCalledWith('/tmp/native-bridge-demo.txt');
    expect(electronMocks.shell.showItemInFolder).toHaveBeenCalled();
  });

  it('fails when a host action does not provide a target', async () => {
    const result = await executeNativeBridgeDesktopActions([{ type: 'open_application' }]);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NATIVE_BRIDGE_TARGET_REQUIRED');
  });
});
