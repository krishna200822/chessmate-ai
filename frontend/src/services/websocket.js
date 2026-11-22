/**
 * Robust WebSocket client with auto-reconnection and event dispatching.
 */

export class GameWebSocket {
  constructor(gameId, onStatusChange = null) {
    this.gameId = gameId;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.baseDelay = 1000;
    this.isExplicitlyClosed = false;
    this.pingInterval = null;

    this.connect();
  }

  connect() {
    if (!this.gameId) return;

    this.isExplicitlyClosed = false;
    let wsUrl;
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
      const parsed = new URL(apiUrl, window.location.href);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${parsed.host}/ws/game/${this.gameId}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/game/${this.gameId}`;
    }

    if (this.onStatusChange) {
      this.onStatusChange('connecting');
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onStatusChange) {
          this.onStatusChange('connected');
        }
        this._startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const msg = JSON.parse(event.data);
          const eventType = msg.event;
          const data = msg.data;

          if (this.handlers.has(eventType)) {
            for (const handler of this.handlers.get(eventType)) {
              handler(data);
            }
          }
        } catch (e) {
          console.warn('Failed parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this._stopPing();
        if (this.onStatusChange) {
          this.onStatusChange('disconnected');
        }
        if (!this.isExplicitlyClosed) {
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      console.error('Failed creating WebSocket:', err);
      this._scheduleReconnect();
    }
  }

  _startPing() {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25000);
  }

  _stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached');
      if (this.onStatusChange) {
        this.onStatusChange('failed');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, this.baseDelay * Math.pow(1.5, this.reconnectAttempts));

    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType, handler) {
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType).delete(handler);
    }
  }

  close() {
    this.isExplicitlyClosed = true;
    this._stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
