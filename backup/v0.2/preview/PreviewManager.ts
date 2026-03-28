export type PreviewMode = 'sidebar' | 'collapsible' | 'detached';

interface PreviewState {
  mode: PreviewMode;
  isExpanded: boolean;
  currentUrl?: string;
}

export class PreviewManager {
  private mode: PreviewMode = 'sidebar';
  private isExpanded: boolean = false;
  private currentUrl?: string;

  setMode(mode: PreviewMode): void {
    this.mode = mode;
    if (mode === 'collapsible') {
      this.isExpanded = false;
    }
    console.log(`[PreviewManager] Mode changed to: ${mode}`);
  }

  getMode(): PreviewMode {
    return this.mode;
  }

  setExpanded(expanded: boolean): void {
    if (this.mode === 'collapsible') {
      this.isExpanded = expanded;
    }
  }

  isPreviewExpanded(): boolean {
    return this.isExpanded;
  }

  setCurrentUrl(url: string): void {
    this.currentUrl = url;
  }

  getCurrentUrl(): string | undefined {
    return this.currentUrl;
  }

  getState(): PreviewState {
    return {
      mode: this.mode,
      isExpanded: this.isExpanded,
      currentUrl: this.currentUrl,
    };
  }
}

export default PreviewManager;
