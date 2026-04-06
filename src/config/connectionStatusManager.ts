export type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export class ConnectionStatusManager {
  private statuses: Record<IMPlatform, ConnectionStatus> = {
    feishu: 'disconnected',
    dingtalk: 'disconnected',
    wecom: 'disconnected',
    slack: 'disconnected',
  };

  private listeners: Set<(platform: IMPlatform, status: ConnectionStatus) => void> = new Set();

  setStatus(platform: IMPlatform, status: ConnectionStatus): void {
    if (this.statuses[platform] !== status) {
      this.statuses[platform] = status;
      console.log(`[ConnectionStatusManager] ${platform} status changed to: ${status}`);
      this.listeners.forEach((listener) => {
        try {
          listener(platform, status);
        } catch (error) {
          console.error('[ConnectionStatusManager] Listener error:', error);
        }
      });
    }
  }

  getStatus(platform: IMPlatform): ConnectionStatus {
    return this.statuses[platform];
  }

  onStatusChange(callback: (platform: IMPlatform, status: ConnectionStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getAllStatuses(): Record<IMPlatform, ConnectionStatus> {
    return { ...this.statuses };
  }

  reset(): void {
    this.statuses = {
      feishu: 'disconnected',
      dingtalk: 'disconnected',
      wecom: 'disconnected',
      slack: 'disconnected',
    };
    this.listeners.clear();
  }
}

let connectionStatusManagerInstance: ConnectionStatusManager | null = null;

export function getConnectionStatusManager(): ConnectionStatusManager {
  if (!connectionStatusManagerInstance) {
    connectionStatusManagerInstance = new ConnectionStatusManager();
  }
  return connectionStatusManagerInstance;
}
