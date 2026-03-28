import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { PREVIEW_CONFIG } from '../config/constants';

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  console.log('[Window] Creating mainWindow, preload path:', path.join(__dirname, '../../preload/index.js'));

  const mainWindow = new BrowserWindow({
    width: Math.floor(width * 0.7),
    height: Math.floor(height * 0.8),
    minWidth: 800,
    minHeight: 600,
    title: 'OpenCowork',
    backgroundColor: '#0F0F14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  return mainWindow;
}

export function createPreviewWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  console.log('[Window] Creating previewWindow, preload path:', path.join(__dirname, '../../preload/index.js'));

  // 预览窗口默认在主窗口右侧
  const previewWindow = new BrowserWindow({
    width: PREVIEW_CONFIG.detached.width,
    height: PREVIEW_CONFIG.detached.height,
    minWidth: PREVIEW_CONFIG.detached.minWidth,
    minHeight: PREVIEW_CONFIG.detached.minHeight,
    title: PREVIEW_CONFIG.detached.title,
    backgroundColor: '#0F0F14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 预览窗口加载固定页面
  if (process.env.NODE_ENV === 'development') {
    previewWindow.loadURL('http://localhost:3000/preview.html');
  } else {
    previewWindow.loadFile(path.join(__dirname, '../../renderer/preview.html'));
  }

  previewWindow.once('ready-to-show', () => {
    previewWindow.show();
  });

  return previewWindow;
}

export function showPreviewWindow(): void {
  const previewWindows = BrowserWindow.getAllWindows().filter(
    (win) => win.getTitle().includes('Preview')
  );
  if (previewWindows.length > 0) {
    previewWindows[0].show();
  }
}

export function hidePreviewWindow(): void {
  const previewWindows = BrowserWindow.getAllWindows().filter(
    (win) => win.getTitle().includes('Preview')
  );
  if (previewWindows.length > 0) {
    previewWindows[0].hide();
  }
}

export function closePreviewWindow(): void {
  const previewWindows = BrowserWindow.getAllWindows().filter(
    (win) => win.getTitle().includes('Preview')
  );
  if (previewWindows.length > 0) {
    previewWindows[0].close();
  }
}
