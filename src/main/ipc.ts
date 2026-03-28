import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../config/constants';
import { IPC_HANDLERS } from './ipcHandlers';

export function setupIPC(mainWindow: BrowserWindow | null, previewWindow: BrowserWindow | null): void {
  console.log('[IPC] setupIPC called, mainWindow:', mainWindow ? 'exists' : 'null', 'previewWindow:', previewWindow ? 'exists' : 'null');
  
  // 注册所有IPC处理器
  Object.entries(IPC_HANDLERS).forEach(([channel, handler]) => {
    ipcMain.handle(channel, async (event, payload) => {
      console.log(`[IPC] ${channel}:`, payload, 'mainWindow:', mainWindow ? 'exists' : 'null');
      try {
        const result = await handler(mainWindow, previewWindow, payload);
        return { success: true, data: result };
      } catch (error: any) {
        console.error(`[IPC] ${channel} error:`, error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });
  });

  console.log('[IPC] IPC handlers registered');
}
