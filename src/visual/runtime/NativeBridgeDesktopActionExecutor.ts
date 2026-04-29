import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { ActionExecutionResult, UIAction } from '../types/visualProtocol';

const NATIVE_BRIDGE_ACTIONS = new Set<UIAction['type']>([
  'open_application',
  'focus_window',
  'open_file',
  'save_file',
  'upload_file',
  'download_file',
]);

function normalizeTargetPath(action: UIAction): string | null {
  const candidate = action.targetPath || action.applicationPath || action.uri || action.text || '';
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

function isUri(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
}

function focusMainWindow(): void {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  const target = windows[0];
  if (!target) {
    return;
  }

  try {
    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
  } catch (error) {
    console.warn('[NativeBridgeDesktopActionExecutor] Failed to focus window:', error);
  }
}

function focusWindowByTitle(windowTitle: string): boolean {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  const normalizedWindowTitle = windowTitle.trim().toLowerCase();
  const target = windows.find((window) => {
    try {
      return typeof window.getTitle === 'function' && window.getTitle().toLowerCase().includes(normalizedWindowTitle);
    } catch {
      return false;
    }
  });

  if (!target) {
    return false;
  }

  try {
    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
    return true;
  } catch (error) {
    console.warn('[NativeBridgeDesktopActionExecutor] Failed to focus window by title:', error);
    return false;
  }
}

async function openTargetPath(targetPath: string): Promise<string> {
  if (isUri(targetPath)) {
    await shell.openExternal(targetPath);
    return '';
  }

  return shell.openPath(targetPath);
}

async function revealTargetPath(targetPath: string): Promise<void> {
  const resolvedPath = path.resolve(targetPath);
  shell.showItemInFolder(resolvedPath);
}

export function isNativeBridgeDesktopAction(action: UIAction): boolean {
  return NATIVE_BRIDGE_ACTIONS.has(action.type);
}

export async function executeNativeBridgeDesktopActions(actions: UIAction[]): Promise<ActionExecutionResult> {
  const executed: UIAction[] = [];

  for (const action of actions) {
    if (!isNativeBridgeDesktopAction(action)) {
      return {
        success: false,
        executed,
        error: {
          code: 'NATIVE_BRIDGE_UNSUPPORTED_ACTION',
          message: `Unsupported native bridge action: ${action.type}`,
          recoverable: true,
        },
      };
    }

    try {
      switch (action.type) {
        case 'focus_window':
          if (action.windowTitle && action.windowTitle.trim().length > 0) {
            const focused = focusWindowByTitle(action.windowTitle);
            if (!focused) {
              return {
                success: false,
                executed,
                error: {
                  code: 'NATIVE_BRIDGE_WINDOW_NOT_FOUND',
                  message: `Unable to find a host window matching title: ${action.windowTitle}`,
                  recoverable: true,
                },
              };
            }
          } else {
            focusMainWindow();
          }
          executed.push(action);
          break;
        case 'open_application':
        case 'open_file': {
          const targetPath = normalizeTargetPath(action);
          if (!targetPath) {
            return {
              success: false,
              executed,
              error: {
                code: 'NATIVE_BRIDGE_TARGET_REQUIRED',
                message: `${action.type} requires a targetPath, applicationPath, uri, or text value`,
                recoverable: true,
              },
            };
          }

          const openResult = await openTargetPath(targetPath);
          if (openResult) {
            return {
              success: false,
              executed,
              error: {
                code: 'NATIVE_BRIDGE_OPEN_FAILED',
                message: openResult,
                recoverable: true,
              },
            };
          }

          executed.push(action);
          break;
        }
        case 'save_file':
        case 'upload_file':
        case 'download_file': {
          const targetPath = normalizeTargetPath(action);
          if (!targetPath) {
            return {
              success: false,
              executed,
              error: {
                code: 'NATIVE_BRIDGE_TARGET_REQUIRED',
                message: `${action.type} requires a targetPath, applicationPath, uri, or text value`,
                recoverable: true,
              },
            };
          }

          await revealTargetPath(targetPath);
          executed.push(action);
          break;
        }
        default:
          return {
            success: false,
            executed,
            error: {
              code: 'NATIVE_BRIDGE_UNSUPPORTED_ACTION',
              message: `Unsupported native bridge action: ${action.type}`,
              recoverable: true,
            },
          };
      }
    } catch (error: any) {
      return {
        success: false,
        executed,
        error: {
          code: 'NATIVE_BRIDGE_ACTION_FAILED',
          message: error?.message || String(error),
          recoverable: true,
        },
      };
    }
  }

  return {
    success: true,
    executed,
  };
}
