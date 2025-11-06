export class CTFSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Array<(message: any) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url?: string) {
    // Use provided URL, or environment variable, or build from window.location
    if (url) {
      this.url = url;
    } else if (typeof window !== 'undefined') {
      // Check for explicit env variable first
      const envUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (envUrl) {
        this.url = envUrl;
      } else {
        // Auto-detect protocol based on page protocol
        const wsHost = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '8080';

        // Use WSS only if page is loaded via HTTPS
        if (window.location.protocol === 'https:') {
          this.url = `wss://${wsHost}:${wsPort}`;
        } else {
          this.url = `ws://${wsHost}:${wsPort}`;
        }
      }
      console.log('[CTFSocket] Using WebSocket URL:', this.url);
    } else {
      // Fallback for server-side rendering
      this.url = 'ws://localhost:8080';
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[CTFSocket] Connected to Wyrt server');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            let message = JSON.parse(event.data);
            // console.log('[CTFSocket] Received:', message);

            // Handle Wyrt's message format:
            // type 0 = System/Game messages (msg contains JSON game data)
            // type 1 = Error messages (msg contains error text)
            // type 2 = Chat messages
            if (message.type === 0 && message.msg) {
              // Game message - unwrap the JSON
              try {
                message = JSON.parse(message.msg);
                // console.log('[CTFSocket] Parsed inner message:', message);
              } catch (e) {
                // If msg is not JSON, use as is
                message = { type: 'text', content: message.msg };
              }
            } else if (message.type === 1) {
              // Error message - show error
              console.error('[CTFSocket] Server error:', message.msg);
              message = { type: 'error', content: message.msg };
            } else if (message.type === 2) {
              // Chat message
              message = { type: 'chat', content: message.msg };
            }

            this.handleMessage(message);
          } catch (error) {
            console.error('[CTFSocket] Failed to parse message:', error, 'Raw data:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[CTFSocket] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[CTFSocket] Disconnected from server');
          this.reconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a request to the server
   * Format: { type: 'request_type', ...payload }
   */
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      // console.log('[CTFSocket] Sending:', data);
      this.ws.send(message);
    } else {
      console.error('[CTFSocket] WebSocket not connected, cannot send:', data);
    }
  }

  /**
   * Enter the CTF game
   */
  enterGame(playerName: string) {
    this.send({
      type: 'ctfEnterGame',
      name: playerName
    });
  }

  /**
   * Send movement update
   */
  move(position: { x: number; y: number }, direction: string) {
    this.send({
      type: 'ctfMove',
      position,
      direction
    });
  }

  /**
   * Attempt to pick up flag
   */
  pickupFlag(flagTeam: 'red' | 'blue') {
    this.send({
      type: 'ctfPickupFlag',
      flagTeam
    });
  }

  /**
   * Attempt to pick up weapon
   */
  pickupWeapon(weaponId: string) {
    this.send({
      type: 'ctfPickupWeapon',
      weaponId
    });
  }

  /**
   * Shoot projectile
   */
  shoot(direction: { x: number; y: number }) {
    this.send({
      type: 'ctfShoot',
      direction
    });
  }

  /**
   * Use item (activate boost)
   */
  useItem() {
    this.send({
      type: 'ctfUseItem'
    });
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      // Return unsubscribe function
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  private handleMessage(message: any) {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CTFSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[CTFSocket] Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[CTFSocket] Reconnection failed:', err);
      });
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers = [];
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let socket: CTFSocket | null = null;

export function getSocket(): CTFSocket {
  if (!socket) {
    socket = new CTFSocket();
  }
  return socket;
}
