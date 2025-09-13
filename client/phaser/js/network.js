class NetworkManager {
    constructor(url, game) {
        this.url = url;
        this.game = game;
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.messageQueue = [];
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    console.log('Connected to server');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Start ping interval
                    this.startPingInterval();
                    
                    // Process queued messages
                    this.processMessageQueue();
                    
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.connected = false;
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from server');
                    this.connected = false;
                    this.authenticated = false;
                    
                    // Stop ping interval
                    this.stopPingInterval();
                    
                    // Attempt reconnection
                    this.reconnect();
                };
                
            } catch (error) {
                console.error('Failed to connect:', error);
                reject(error);
            }
        });
    }
    
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.showConnectionError();
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    authenticate(username, password) {
        return new Promise((resolve, reject) => {
            // First authenticate with HTTP endpoint to get token
            fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success && data.token) {
                    // Use token to authenticate WebSocket connection
                    this.send({
                        type: 'authenticate',
                        token: data.token
                    });
                    
                    // Wait for authentication response
                    const authHandler = (message) => {
                        if (message.type === 'authenticate') {
                            if (message.success) {
                                this.authenticated = true;
                                console.log('Authenticated successfully');
                                resolve(message);
                            } else {
                                reject(new Error(message.message || 'Authentication failed'));
                            }
                        }
                    };
                    
                    // Temporary handler for auth response
                    this.authHandler = authHandler;
                    
                } else {
                    reject(new Error(data.message || 'Login failed'));
                }
            })
            .catch(error => {
                console.error('Authentication error:', error);
                reject(error);
            });
        });
    }
    
    handleMessage(message) {
        // Check for auth handler
        if (this.authHandler && message.type === 'authenticate') {
            this.authHandler(message);
            this.authHandler = null;
            return;
        }
        
        // Handle system messages
        switch (message.type) {
            case 'connected':
                console.log(`Connected to ${message.instanceName} (${message.instanceType})`);
                break;
                
            case 'ping':
                this.send({ type: 'pong' });
                break;
                
            case 'error':
                console.error('Server error:', message.message);
                this.showError(message.message);
                break;
                
            default:
                // Pass to game handler
                if (this.game) {
                    this.game.handleMessage(message);
                }
        }
    }
    
    send(message) {
        if (!this.connected) {
            // Queue message for later
            this.messageQueue.push(message);
            return;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
            this.messageQueue.push(message);
        }
    }
    
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.connected) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
    
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping' });
            }
        }, 30000); // Ping every 30 seconds
    }
    
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    showConnectionError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 10000;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>Connection Lost</h3>
            <p>Unable to connect to the game server.</p>
            <button onclick="location.reload()">Refresh Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    disconnect() {
        if (this.ws) {
            this.connected = false;
            this.authenticated = false;
            this.ws.close();
            this.ws = null;
        }
        
        this.stopPingInterval();
    }
}