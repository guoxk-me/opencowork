import { BrowserWindow, webContents, WebContents } from 'electron';
import {
  createCDPWebviewBridge,
  getCDPWebviewBridge,
  destroyCDPWebviewBridge,
} from './cdpWebviewBridge';

let isBridgeInitialized = false;

export const CDP_WEBVIEW_BRIDGE_HANDLERS = {
  'cdpBridge:initialize': async (
    _mainWindow: BrowserWindow | null,
    _previewWindow: BrowserWindow | null,
    { port }: { port?: number } = {}
  ): Promise<{ success: boolean; error?: string; port?: number }> => {
    try {
      if (isBridgeInitialized && getCDPWebviewBridge()) {
        const bridge = getCDPWebviewBridge()!;
        return { success: true, port: bridge.getPort() };
      }

      const bridge = createCDPWebviewBridge(port);
      await bridge.initialize();
      isBridgeInitialized = true;
      console.log('[CDPWebviewBridgeIPC] Bridge initialized on port', bridge.getPort());
      return { success: true, port: bridge.getPort() };
    } catch (error: any) {
      console.error('[CDPWebviewBridgeIPC] init error:', error);
      return { success: false, error: error.message };
    }
  },

  'cdpBridge:attachWebview': async (
    _mainWindow: BrowserWindow | null,
    _previewWindow: BrowserWindow | null,
    { webContentsId }: { webContentsId: number }
  ): Promise<{ success: boolean; error?: string; webSocketUrl?: string }> => {
    try {
      let bridge = getCDPWebviewBridge();
      if (!bridge) {
        bridge = createCDPWebviewBridge();
        await bridge.initialize();
        isBridgeInitialized = true;
      }

      const targetContents = findWebContentsById(webContentsId);
      if (!targetContents) {
        return { success: false, error: `WebContents with ID ${webContentsId} not found` };
      }

      await bridge.attachToWebview(targetContents);
      return { success: true, webSocketUrl: bridge.getWebSocketUrl() };
    } catch (error: any) {
      console.error('[CDPWebviewBridgeIPC] attachWebview error:', error);
      return { success: false, error: error.message };
    }
  },

  'cdpBridge:detachWebview': async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const bridge = getCDPWebviewBridge();
      if (!bridge) {
        return { success: true };
      }
      await bridge.detachFromWebview();
      return { success: true };
    } catch (error: any) {
      console.error('[CDPWebviewBridgeIPC] detachWebview error:', error);
      return { success: false, error: error.message };
    }
  },

  'cdpBridge:getStatus': async (): Promise<{
    success: boolean;
    error?: string;
    isInitialized?: boolean;
    isAttached?: boolean;
    webSocketUrl?: string;
    port?: number;
    clientCount?: number;
  }> => {
    try {
      const bridge = getCDPWebviewBridge();
      if (!bridge) {
        return {
          success: true,
          isInitialized: false,
          isAttached: false,
          clientCount: 0,
        };
      }
      return {
        success: true,
        isInitialized: bridge.isInitialized(),
        isAttached: bridge.getIsAttached(),
        webSocketUrl: bridge.getWebSocketUrl(),
        port: bridge.getPort(),
        clientCount: bridge.getClientCount(),
      };
    } catch (error: any) {
      console.error('[CDPWebviewBridgeIPC] getStatus error:', error);
      return { success: false, error: error.message };
    }
  },

  'cdpBridge:destroy': async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await destroyCDPWebviewBridge();
      isBridgeInitialized = false;
      return { success: true };
    } catch (error: any) {
      console.error('[CDPWebviewBridgeIPC] destroy error:', error);
      return { success: false, error: error.message };
    }
  },
};

function findWebContentsById(targetId: number): WebContents | null {
  const allContents = webContents.getAllWebContents();

  for (const contents of allContents) {
    if (contents.id === targetId) {
      return contents;
    }
  }

  console.warn(`[CDPWebviewBridgeIPC] WebContents with ID ${targetId} not found`);
  return null;
}

export async function initializeCDPBridge(): Promise<void> {
  try {
    const bridge = createCDPWebviewBridge();
    await bridge.initialize();
    isBridgeInitialized = true;
    console.log('[CDPWebviewBridgeIPC] Bridge auto-initialized');
  } catch (error: any) {
    console.error('[CDPWebviewBridgeIPC] Auto-initialize failed:', error);
  }
}

export async function cleanupCDPBridge(): Promise<void> {
  try {
    await destroyCDPWebviewBridge();
    isBridgeInitialized = false;
    console.log('[CDPWebviewBridgeIPC] Bridge cleaned up');
  } catch (error: any) {
    console.error('[CDPWebviewBridgeIPC] Cleanup failed:', error);
  }
}
