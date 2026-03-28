import { BrowserWindow } from 'electron';

export interface ScreencastConfig {
  fps: number;              // 帧率，默认 5
  quality: number;         // 图片质量 0-100，默认 60
  maxWidth: number;        // 最大宽度，默认 800
  maxHeight: number;       // 最大高度，默认 450
}

const DEFAULT_CONFIG: ScreencastConfig = {
  fps: 5,
  quality: 60,
  maxWidth: 800,
  maxHeight: 450,
};

export class ScreencastService {
  private page: any = null;
  private mainWindow: BrowserWindow | null = null;
  private config: ScreencastConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;

  constructor(config: Partial<ScreencastConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setPage(page: any): void {
    this.page = page;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  start(): void {
    if (this.isRunning) {
      console.log('[Screencast] Already running');
      return;
    }
    
    if (!this.page || !this.mainWindow) {
      console.log('[Screencast] Cannot start: missing page or mainWindow');
      return;
    }

    const interval = 1000 / this.config.fps;
    this.isRunning = true;
    this.frameCount = 0;

    console.log(`[Screencast] Starting with ${this.config.fps}fps, quality ${this.config.quality}%`);

    this.intervalId = setInterval(async () => {
      await this.captureFrame();
    }, interval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Screencast] Stopped');
  }

  private async captureFrame(): Promise<void> {
    if (!this.page || !this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      const screenshot = await this.page.screenshot({
        type: 'jpeg',
        quality: this.config.quality,
        fullPage: false,
      });

      const base64 = Buffer.from(screenshot).toString('base64');
      
      this.frameCount++;
      this.lastFrameTime = Date.now();

      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('preview:screenshot', base64);
      }

      if (this.frameCount % 30 === 0) {
        console.log(`[Screencast] Sent ${this.frameCount} frames, last at ${Date.now()}`);
      }
    } catch (error) {
      // 静默处理错误，避免频繁打印
    }
  }

  updateConfig(config: Partial<ScreencastConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStats(): { fps: number; frames: number; lastFrame: number } {
    return {
      fps: this.config.fps,
      frames: this.frameCount,
      lastFrame: this.lastFrameTime,
    };
  }
}

export default ScreencastService;