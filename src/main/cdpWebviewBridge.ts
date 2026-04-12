import { WebContents, NativeImage } from 'electron';
import WebSocket, { WebSocketServer, WebSocket as WS } from 'ws';

const CDP_BRIDGE_PORT = 9229;
const CDP_ATTACH_TIMEOUT = 30000;
const CLIENT_MESSAGE_TIMEOUT = 30000;
const WEBVIEW_BROWSER_CONTEXT_ID = 'opencowebview-context';

interface CDPClient {
  ws: WS;
  id: string;
  isPlaywright: boolean;
  lastMessageTime: number;
  targetDiscoveryEnabled: boolean;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}

interface CDPMessage {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
  sessionId?: string;
}

export class CDPWebviewBridge {
  private wsServer: WebSocketServer | null = null;
  private webviewContents: WebContents | null = null;
  private clients: Map<string, CDPClient> = new Map();
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private sessions: Map<string, WS> = new Map();
  private nextMessageId: number = 1;
  private bridgePort: number = CDP_BRIDGE_PORT;
  private isDestroyed: boolean = false;
  private isAttached: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rootSessionId = 'cdp-bridge-root';

  constructor(port?: number) {
    if (port !== undefined && port > 0 && port < 65536) {
      this.bridgePort = port;
    }
  }

  async initialize(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('CDPWebviewBridge has been destroyed');
    }

    if (this.wsServer) {
      console.log('[CDPWebviewBridge] Already initialized');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.wsServer = new WebSocketServer({ port: this.bridgePort });

        this.wsServer.on('listening', () => {
          console.log(`[CDPWebviewBridge] WebSocket server listening on port ${this.bridgePort}`);
          this.startHeartbeat();
          resolve();
        });

        this.wsServer.on('connection', (ws: WS, request) => {
          const clientId = `playwright-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          console.log(`[CDPWebviewBridge] Client connected: ${clientId}, url: ${request.url}`);

          const client: CDPClient = {
            ws,
            id: clientId,
            isPlaywright: false,
            lastMessageTime: Date.now(),
            targetDiscoveryEnabled: false,
          };
          this.clients.set(clientId, client);

          ws.on('message', (data: Buffer) => {
            this.handleClientMessage(clientId, data);
          });

          ws.on('close', () => {
            console.log(`[CDPWebviewBridge] Client disconnected: ${clientId}`);
            this.cleanupClient(clientId);
          });

          ws.on('error', (error) => {
            console.error(`[CDPWebviewBridge] Client ${clientId} error:`, error.message);
            this.cleanupClient(clientId);
          });

          ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
              client.lastMessageTime = Date.now();
            }
          });
        });

        this.wsServer.on('error', (error: any) => {
          console.error('[CDPWebviewBridge] WebSocket server error:', error.message);
          if (!this.wsServer) {
            reject(error);
          }
        });

        this.wsServer.on('close', () => {
          console.log('[CDPWebviewBridge] WebSocket server closed');
          this.wsServer = null;
        });
      } catch (error: any) {
        console.error('[CDPWebviewBridge] Initialization error:', error.message);
        reject(error);
      }
    });
  }

  async attachToWebview(webviewContents: WebContents): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('CDPWebviewBridge has been destroyed');
    }

    if (this.isAttached && this.webviewContents === webviewContents) {
      console.log('[CDPWebviewBridge] Already attached to this webview');
      return;
    }

    await this.detachFromWebview();

    this.webviewContents = webviewContents;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Webview attachment timeout after ${CDP_ATTACH_TIMEOUT}ms`));
      }, CDP_ATTACH_TIMEOUT);

      const setupListeners = () => {
        if (!this.webviewContents) {
          clearTimeout(timeout);
          reject(new Error('Webview contents became null'));
          return;
        }

        const events: Array<{ name: string; forward: boolean }> = [
          { name: 'did-finish-load', forward: true },
          { name: 'did-fail-load', forward: true },
          { name: 'did-navigate', forward: true },
          { name: 'did-navigate-in-page', forward: true },
          { name: 'will-navigate', forward: true },
          { name: 'page-title-updated', forward: true },
          { name: 'load-commit', forward: false },
          { name: 'console-message', forward: true },
          { name: 'render-process-gone', forward: true },
          { name: 'crashed', forward: true },
          { name: 'responsive', forward: false },
          { name: 'unresponsive', forward: false },
        ];

        events.forEach(({ name, forward }) => {
          if (forward && this.webviewContents) {
            this.webviewContents.on(name as any, (...args: any[]) => {
              this.forwardEvent(name, args);
            });
          }
        });

        clearTimeout(timeout);
        this.isAttached = true;
        console.log('[CDPWebviewBridge] Attached to webview successfully');

        this.clients.forEach((client, clientId) => {
          if (client.targetDiscoveryEnabled) {
            this.sendTargetCreatedToClient(clientId);
          }
        });

        resolve();
      };

      if (webviewContents.isLoading() === false && webviewContents.getURL()) {
        setupListeners();
      } else {
        webviewContents.once('did-finish-load', () => {
          setupListeners();
        });
        webviewContents.once(
          'did-fail-load',
          (_event: any, errorCode: number, errorDescription: string) => {
            clearTimeout(timeout);
            reject(new Error(`Webview failed to load: ${errorDescription} (${errorCode})`));
          }
        );
      }
    });
  }

  async detachFromWebview(): Promise<void> {
    if (this.webviewContents) {
      this.webviewContents = null;
    }
    this.isAttached = false;
    console.log('[CDPWebviewBridge] Detached from webview');
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000;

      this.clients.forEach((client, clientId) => {
        if (now - client.lastMessageTime > staleThreshold) {
          console.log(`[CDPWebviewBridge] Client ${clientId} is stale, closing`);
          client.ws.terminate();
          this.cleanupClient(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);
  }

  private cleanupClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
    }
    this.pendingRequests.forEach((pending, id) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    });
  }

  private handleClientMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[CDPWebviewBridge] Message from unknown client: ${clientId}`);
      return;
    }

    client.lastMessageTime = Date.now();

    try {
      const message: CDPMessage = JSON.parse(data.toString());
      console.log(`[CDPWebviewBridge] Client ${clientId} sent:`, message.method || 'response');

      if (!client.isPlaywright && message.method) {
        client.isPlaywright = true;
        console.log(`[CDPWebviewBridge] Client ${clientId} identified as Playwright`);
      }

      if (message.id !== undefined) {
        this.handleCDPCommand(clientId, message);
      } else if (message.method) {
        this.handleCDPNotification(clientId, message);
      }
    } catch (error: any) {
      console.error('[CDPWebviewBridge] Error parsing client message:', error.message);
    }
  }

  private async handleCDPCommand(clientId: string, message: CDPMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { id, method, params } = message;

    if (id === undefined) {
      console.warn('[CDPWebviewBridge] Message has no id, ignoring');
      return;
    }

    if (!method) {
      console.warn('[CDPWebviewBridge] Message has no method, ignoring');
      return;
    }

    const messageSessionId = (message as any).sessionId as string | undefined;
    if (
      messageSessionId &&
      messageSessionId !== this.rootSessionId &&
      this.sessions.has(messageSessionId)
    ) {
      await this.executeChildSessionCommand(clientId, messageSessionId!, message);
      return;
    }

    const timeout = setTimeout(() => {
      this.pendingRequests.delete(id);
    }, CLIENT_MESSAGE_TIMEOUT);

    const requestId = id;

    this.pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.sendToClient(clientId, {
          id: requestId,
          result,
          sessionId: this.getSessionId(),
        });
      },
      reject: (error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.sendToClient(clientId, {
          id: requestId,
          error: {
            code: -32603,
            message: error.message || String(error),
          },
          sessionId: this.getSessionId(),
        });
      },
      timeout,
    });

    try {
      const result = await this.executeCDPCommand(method, params, clientId);
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        pending.resolve(result);
      }
    } catch (error: any) {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        pending.reject(error);
      }
    }
  }

  private async executeChildSessionCommand(
    clientId: string,
    sessionId: string,
    message: CDPMessage
  ): Promise<void> {
    const cid: string = clientId;
    const { id, method, params } = message;

    if (id === undefined) {
      return;
    }

    console.log(`[CDPWebviewBridge] Child session command: ${method} (session: ${sessionId})`);

    switch (method) {
      case 'Target.detachFromTarget': {
        this.removeChildSession(sessionId);
        this.sendToClient(cid, {
          id,
          result: { success: true },
          sessionId,
        });
        return;
      }

      case 'Runtime.runIfWaitingForDebugger': {
        this.sendToClient(cid, {
          id,
          result: { success: true },
          sessionId,
        });
        return;
      }

      default: {
        try {
          const result = await (this.executeCDPCommand as any)(method, params, cid);
          this.sendToClient(cid, {
            id,
            result,
            sessionId,
          });
        } catch (error: any) {
          this.sendToClient(cid, {
            id,
            error: { code: -32603, message: error.message || String(error) },
            sessionId,
          });
        }
        return;
      }
    }
  }

  private handleCDPNotification(clientId: string, message: CDPMessage): void {
    console.log(`[CDPWebviewBridge] Client notification: ${message.method}`);
  }

  private async executeCDPCommand(
    method: string,
    params?: any,
    clientId?: string | null
  ): Promise<any> {
    const activeClientId = clientId ?? '';
    if (!this.webviewContents) {
      throw new Error('No webview attached');
    }

    console.log(
      `[CDPWebviewBridge] Executing CDP command: ${method}`,
      params ? JSON.stringify(params).substring(0, 200) : ''
    );

    switch (method) {
      case 'Browser.getVersion': {
        return {
          protocolVersion: '1.3',
          product: 'Chrome/120.0.0.0',
          revision: '121.0.0',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          jsVersion: '12.0.0',
        };
      }

      case 'Target.getTargets': {
        if (!this.webviewContents) {
          return { targets: [] };
        }
        return {
          targets: [
            {
              targetId: `webview-${this.webviewContents.id}`,
              type: 'page',
              title: this.webviewContents.getTitle() || 'Webview',
              url: this.webviewContents.getURL() || '',
              attached: true,
              canAccessOpener: false,
              browserContextId: WEBVIEW_BROWSER_CONTEXT_ID,
            },
          ],
        };
      }

      case 'Page.enable':
        return { success: true };

      case 'Page.disable':
        return { success: true };

      case 'Page.createIsolatedWorld': {
        return {
          executionContextId: 1,
        };
      }

      case 'Page.setLifecycleEventsEnabled': {
        return { success: true };
      }

      case 'Target.setDiscoverTargets': {
        if (params?.discover && activeClientId) {
          const client = this.clients.get(activeClientId);
          if (client) {
            client.targetDiscoveryEnabled = true;
            console.log(`[CDPWebviewBridge] Client ${activeClientId} enabled target discovery`);

            if (this.isAttached && this.webviewContents) {
              this.sendTargetCreatedToClient(activeClientId);
            }
          }
        }
        return { success: true };
      }

      case 'Target.setAutoAttach': {
        if (this.isAttached && this.webviewContents) {
          setTimeout(() => {
            if (this.isAttached && this.webviewContents) {
              this.sendAttachedToTarget(activeClientId);
            }
          }, 0);
        }
        return { success: true };
      }

      case 'Target.attachToTarget': {
        if (!params?.targetId) {
          throw new Error('targetId is required for Target.attachToTarget');
        }
        const targetId = params.targetId;
        if (this.webviewContents && targetId === `webview-${this.webviewContents.id}`) {
          const childSessionId = `cdp-bridge-child-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          this.createChildSession(childSessionId, this.clients.get(activeClientId)?.ws!);
          setTimeout(() => {
            this.sendAttachedToTarget(activeClientId);
          }, 0);
          return {
            sessionId: childSessionId,
            targetInfo: {
              targetId: `webview-${this.webviewContents.id}`,
              type: 'page',
              title: this.webviewContents.getTitle() || 'Webview',
              url: this.webviewContents.getURL() || '',
              attached: true,
              canAccessOpener: false,
              browserContextId: WEBVIEW_BROWSER_CONTEXT_ID,
            },
          };
        }
        throw new Error('Target not found');
      }

      case 'Target.closeTarget': {
        return { success: false, error: 'Cannot close webview target' };
      }

      case 'Target.getTargetInfo': {
        if (!this.webviewContents) {
          return { targetInfo: null };
        }
        return {
          targetInfo: {
            targetId: `webview-${this.webviewContents.id}`,
            type: 'page',
            title: this.webviewContents.getTitle() || 'Webview',
            url: this.webviewContents.getURL() || '',
            attached: true,
            canAccessOpener: false,
          },
        };
      }

      case 'Runtime.enable':
        return { success: true };

      case 'Runtime.disable':
        return { success: true };

      case 'DOM.enable':
        return { success: true };

      case 'DOM.disable':
        return { success: true };

      case 'Page.getResourceContent':
        return { content: '', base64Encoded: false };

      case 'Page.captureScreenshot': {
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          this.webviewContents
            .capturePage()
            .then((image: any) => {
              try {
                const base64 = image.toPNG().toString('base64');
                resolve({ data: base64 });
              } catch (error: any) {
                reject(new Error(`Screenshot failed: ${error.message}`));
              }
            })
            .catch((error: any) => {
              reject(new Error(`Screenshot failed: ${error.message}`));
            });
        });
      }

      case 'Page.navigate': {
        if (!params?.url) {
          throw new Error('URL is required for Page.navigate');
        }
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const loaded = () => {
            resolve({ loaderId: '', type: 'complete' });
          };
          const failed = (_event: any, errorCode: number, errorDescription: string) => {
            reject(new Error(`Navigation failed: ${errorDescription} (${errorCode})`));
          };
          this.webviewContents.once('did-finish-load', loaded);
          this.webviewContents.once('did-fail-load', failed);
          try {
            this.webviewContents.loadURL(params.url);
          } catch (error: any) {
            this.webviewContents.removeListener('did-finish-load', loaded);
            this.webviewContents.removeListener('did-fail-load', failed);
            reject(new Error(`LoadURL failed: ${error.message}`));
          }
        });
      }

      case 'Page.reload': {
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const loaded = () => {
            resolve({});
          };
          const failed = (_event: any, errorCode: number, errorDescription: string) => {
            reject(new Error(`Reload failed: ${errorDescription} (${errorCode})`));
          };
          this.webviewContents.once('did-finish-load', loaded);
          this.webviewContents.once('did-fail-load', failed);
          try {
            this.webviewContents.reload();
          } catch (error: any) {
            this.webviewContents.removeListener('did-finish-load', loaded);
            this.webviewContents.removeListener('did-fail-load', failed);
            reject(new Error(`Reload failed: ${error.message}`));
          }
        });
      }

      case 'Page.goBack': {
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          if (!this.webviewContents.canGoBack()) {
            reject(new Error('Cannot go back'));
            return;
          }
          this.webviewContents.once('did-finish-load', () => {
            resolve({});
          });
          this.webviewContents.once(
            'did-fail-load',
            (_event: any, errorCode: number, errorDescription: string) => {
              reject(new Error(`Go back failed: ${errorDescription} (${errorCode})`));
            }
          );
          this.webviewContents.goBack();
        });
      }

      case 'Page.goForward': {
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          if (!this.webviewContents.canGoForward()) {
            reject(new Error('Cannot go forward'));
            return;
          }
          this.webviewContents.once('did-finish-load', () => {
            resolve({});
          });
          this.webviewContents.once(
            'did-fail-load',
            (_event: any, errorCode: number, errorDescription: string) => {
              reject(new Error(`Go forward failed: ${errorDescription} (${errorCode})`));
            }
          );
          this.webviewContents.goForward();
        });
      }

      case 'Runtime.evaluate': {
        if (params?.expression === undefined) {
          throw new Error('Expression is required for Runtime.evaluate');
        }
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const returnByValue = params.returnByValue === true;
          const awaitPromise = params.awaitPromise === true;

          this.webviewContents
            .executeJavaScript(params.expression, awaitPromise)
            .then((result: any) => {
              if (returnByValue) {
                try {
                  const serialized = JSON.parse(JSON.stringify(result));
                  resolve({
                    result: {
                      type: typeof serialized,
                      value: serialized,
                    },
                    exceptionDetails: null,
                  });
                } catch {
                  resolve({
                    result: {
                      type: typeof result,
                      value: String(result),
                    },
                    exceptionDetails: null,
                  });
                }
              } else {
                resolve({
                  result: { type: 'undefined' },
                  exceptionDetails: null,
                });
              }
            })
            .catch((error: any) => {
              reject(new Error(`JS execution error: ${error.message}`));
            });
        });
      }

      case 'Runtime.callFunctionOn': {
        if (!params?.functionDeclaration) {
          throw new Error('Function declaration is required for Runtime.callFunctionOn');
        }
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const returnByValue = params.returnByValue === true;
          const functionDeclaration = params.functionDeclaration;

          this.webviewContents
            .executeJavaScript(functionDeclaration, false)
            .then((result: any) => {
              if (returnByValue) {
                try {
                  const serialized = JSON.parse(JSON.stringify(result));
                  resolve({
                    result: {
                      type: typeof serialized,
                      value: serialized,
                    },
                    exceptionDetails: null,
                  });
                } catch {
                  resolve({
                    result: {
                      type: typeof result,
                      value: String(result),
                    },
                    exceptionDetails: null,
                  });
                }
              } else {
                resolve({
                  result: { type: 'undefined' },
                  exceptionDetails: null,
                });
              }
            })
            .catch((error: any) => {
              reject(new Error(`Function call error: ${error.message}`));
            });
        });
      }

      case 'DOM.getDocument': {
        return Promise.resolve({
          root: {
            nodeId: 1,
            backendNodeId: 1,
            localName: 'html',
            nodeName: 'HTML',
            nodeType: 10,
          },
        });
      }

      case 'DOM.querySelector': {
        if (!params?.nodeId || !params?.selector) {
          throw new Error('nodeId and selector are required for DOM.querySelector');
        }
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const script = `
            (function() {
              try {
                const node = document.querySelector('${params.selector.replace(/'/g, "\\'")}');
                if (!node) return null;
                return {
                  nodeId: 1,
                  backendNodeId: 1,
                  nodeType: node.nodeType,
                  nodeName: node.nodeName
                };
              } catch (e) {
                return null;
              }
            })()
          `;
          this.webviewContents
            .executeJavaScript(script, false)
            .then((result: any) => {
              if (!result) {
                resolve({ nodeId: 0 });
              } else {
                resolve(result);
              }
            })
            .catch((error: any) => {
              reject(new Error(`Query failed: ${error.message}`));
            });
        });
      }

      case 'DOM.querySelectorAll': {
        if (!params?.nodeId || !params?.selector) {
          throw new Error('nodeId and selector are required for DOM.querySelectorAll');
        }
        return new Promise((resolve, reject) => {
          if (!this.webviewContents) {
            reject(new Error('No webview attached'));
            return;
          }
          const script = `
            (function() {
              try {
                const nodes = document.querySelectorAll('${params.selector.replace(/'/g, "\\'")}');
                return Array.from(nodes).map((node, idx) => ({
                  nodeId: idx + 1,
                  backendNodeId: idx + 1,
                  nodeType: node.nodeType,
                  nodeName: node.nodeName
                }));
              } catch (e) {
                return [];
              }
            })()
          `;
          this.webviewContents
            .executeJavaScript(script, false)
            .then((result: any) => {
              resolve({ nodeIds: result || [] });
            })
            .catch((error: any) => {
              reject(new Error(`QueryAll failed: ${error.message}`));
            });
        });
      }

      case 'Input.dispatchMouseEvent': {
        if (!this.webviewContents) {
          throw new Error('No webview attached');
        }
        const { type, x, y, button, clickCount, modifiers } = params || {};

        let eventType: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseDown' | 'mouseUp';
        if (type === 'mousePressed') {
          eventType = 'mousePressed';
        } else if (type === 'mouseReleased') {
          eventType = 'mouseReleased';
        } else if (type === 'mouseMoved') {
          eventType = 'mouseMoved';
        } else if (type === 'mouseDown') {
          eventType = 'mouseDown';
        } else if (type === 'mouseUp') {
          eventType = 'mouseUp';
        } else {
          eventType = 'mousePressed';
        }

        this.webviewContents.sendInputEvent({
          type: eventType,
          x: x || 0,
          y: y || 0,
          button: button || 'left',
          clickCount: clickCount || 1,
          modifiers: modifiers || 0,
        } as any);

        return { success: true };
      }

      case 'Input.dispatchKeyEvent': {
        if (!this.webviewContents) {
          throw new Error('No webview attached');
        }
        const { type, key, code, modifiers, text } = params || {};

        let eventType: 'keyDown' | 'keyUp' | 'char';
        if (type === 'keyDown') {
          eventType = 'keyDown';
        } else if (type === 'keyUp') {
          eventType = 'keyUp';
        } else if (type === 'char') {
          eventType = 'char';
        } else {
          eventType = 'keyDown';
        }

        this.webviewContents.sendInputEvent({
          type: eventType,
          key: key || '',
          code: code || '',
          modifiers: modifiers || 0,
          text: text || key || '',
        } as any);

        return { success: true };
      }

      case 'Tethering.bind': {
        return { success: false, error: 'Tethering not supported' };
      }

      case 'Log.enable': {
        return { success: true };
      }

      case 'Log.disable': {
        return { success: true };
      }

      case 'Overlay.enable': {
        return { success: true };
      }

      case 'Overlay.disable': {
        return { success: true };
      }

      case 'Network.enable': {
        return { success: true };
      }

      case 'Network.disable': {
        return { success: true };
      }

      case 'Network.setRequestInterception': {
        return { success: true };
      }

      case 'Runtime.runIfWaitingForDebugger': {
        return { success: true };
      }

      case 'Target.detachFromTarget': {
        if (!params?.sessionId) {
          return { success: false };
        }
        return { success: true };
      }

      default:
        console.warn(`[CDPWebviewBridge] Unsupported CDP command: ${method}`);
        throw new Error(`Unsupported CDP command: ${method}`);
    }
  }

  private forwardEvent(method: string, args: any[]): void {
    if (!this.webviewContents || this.isDestroyed) {
      return;
    }

    const params = this.formatEventParams(method, args);
    const event: CDPMessage = {
      method,
      params,
      sessionId: this.getSessionId(),
    };

    const message = JSON.stringify(event);
    this.clients.forEach((client) => {
      if (client.isPlaywright && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error: any) {
          console.error(
            `[CDPWebviewBridge] Error forwarding event to ${client.id}:`,
            error.message
          );
        }
      }
    });
  }

  private formatEventParams(method: string, args: any[]): any {
    switch (method) {
      case 'did-finish-load':
        return {};
      case 'did-fail-load':
        return { errorCode: args[0], errorDescription: args[1] };
      case 'did-navigate':
        return { url: args[0], transitionType: 'typed' };
      case 'did-navigate-in-page':
        return { url: args[0], isMainFrame: args[1] };
      case 'will-navigate':
        return { url: args[0] };
      case 'page-title-updated':
        return { title: args[0] };
      case 'console-message':
        return {
          type: 'log',
          level: args[0] === 0 ? 'log' : args[0] === 1 ? 'warn' : 'error',
          text: args[1] || '',
          timestamp: Date.now(),
          lineNumber: args[2],
          sourceId: args[3] || '',
        };
      case 'render-process-gone':
        return { reason: args[0] };
      case 'crashed':
        return {};
      case 'responsive':
        return {};
      case 'unresponsive':
        return {};
      default:
        return args[0] || {};
    }
  }

  private sendToClient(clientId: string, message: CDPMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[CDPWebviewBridge] Cannot send to client ${clientId}: not connected`);
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      client.ws.send(messageStr);
      console.log(
        `[CDPWebviewBridge] Sent to client ${clientId}:`,
        message.method || `response id=${message.id}`
      );
    } catch (error: any) {
      console.error(`[CDPWebviewBridge] Error sending to client ${clientId}:`, error.message);
    }
  }

  private getSessionId(): string {
    return this.rootSessionId;
  }

  private createChildSession(sessionId: string, ws: WS): void {
    this.sessions.set(sessionId, ws);
    console.log(
      `[CDPWebviewBridge] Created child session: ${sessionId}, total: ${this.sessions.size}`
    );
  }

  private removeChildSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(
      `[CDPWebviewBridge] Removed child session: ${sessionId}, remaining: ${this.sessions.size}`
    );
  }

  private cleanupAllChildSessions(): void {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach((sessionId) => {
      this.sessions.delete(sessionId);
    });
    console.log(`[CDPWebviewBridge] Cleaned up all child sessions`);
  }

  getWebSocketUrl(): string {
    return `ws://localhost:${this.bridgePort}`;
  }

  getPort(): number {
    return this.bridgePort;
  }

  getIsAttached(): boolean {
    return this.isAttached;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isInitialized(): boolean {
    return this.wsServer !== null;
  }

  private sendTargetCreatedToClient(clientId: string): void {
    if (!this.webviewContents) {
      return;
    }

    const webviewUrl = this.webviewContents.getURL() || '';
    console.log(
      `[CDPWebviewBridge] Sending Target.targetCreated to client ${clientId} (webview id=${this.webviewContents.id}, url=${webviewUrl})`
    );

    const targetCreatedEvent = {
      method: 'Target.targetCreated',
      params: {
        targetInfo: {
          targetId: `webview-${this.webviewContents.id}`,
          type: 'page',
          title: this.webviewContents.getTitle() || 'Webview',
          url: webviewUrl,
          attached: false,
          canAccessOpener: false,
          browserContextId: WEBVIEW_BROWSER_CONTEXT_ID,
        },
      },
    };

    this.sendToClient(clientId, targetCreatedEvent);
  }

  private sendAttachedToTarget(clientId: string): void {
    if (!this.webviewContents) {
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const childSessionId = `cdp-bridge-child-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.createChildSession(childSessionId, client.ws);

    const webviewUrl = this.webviewContents.getURL() || '';
    console.log(
      `[CDPWebviewBridge] Sending Target.attachedToTarget to client ${clientId} (child session: ${childSessionId}, webview id=${this.webviewContents.id}, url=${webviewUrl})`
    );

    const attachedEvent = {
      method: 'Target.attachedToTarget',
      params: {
        sessionId: childSessionId,
        targetInfo: {
          targetId: `webview-${this.webviewContents.id}`,
          type: 'page',
          title: this.webviewContents.getTitle() || 'Webview',
          url: webviewUrl,
          attached: true,
          canAccessOpener: false,
          browserContextId: WEBVIEW_BROWSER_CONTEXT_ID,
        },
        waitingForDebugger: false,
      },
    };

    this.sendToClient(clientId, attachedEvent);
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge destroyed'));
    });
    this.pendingRequests.clear();

    this.clients.forEach((client) => {
      try {
        client.ws.close(1000, 'Bridge destroyed');
      } catch {}
    });
    this.clients.clear();

    this.cleanupAllChildSessions();

    await this.detachFromWebview();

    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer!.close(() => {
          console.log('[CDPWebviewBridge] WebSocket server closed');
          this.wsServer = null;
          resolve();
        });
      });
    }

    console.log('[CDPWebviewBridge] Destroyed');
  }
}

let cdpWebviewBridgeInstance: CDPWebviewBridge | null = null;

export function getCDPWebviewBridge(): CDPWebviewBridge | null {
  return cdpWebviewBridgeInstance;
}

export function createCDPWebviewBridge(port?: number): CDPWebviewBridge {
  if (cdpWebviewBridgeInstance) {
    console.warn('[CDPWebviewBridge] Instance already exists, returning existing');
    return cdpWebviewBridgeInstance;
  }
  cdpWebviewBridgeInstance = new CDPWebviewBridge(port);
  return cdpWebviewBridgeInstance;
}

export async function destroyCDPWebviewBridge(): Promise<void> {
  if (cdpWebviewBridgeInstance) {
    const instance = cdpWebviewBridgeInstance;
    cdpWebviewBridgeInstance = null;
    await instance.destroy();
  }
}
