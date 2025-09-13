class WyrtGame {
    constructor(username, password, server) {
        this.username = username;
        this.password = password;
        this.server = server;
        this.network = null;
        this.player = null;
        this.entities = new Map();
        this.tileMap = null;
        
        // Initialize Phaser game
        this.config = {
            type: Phaser.AUTO,
            parent: 'game-canvas',
            width: 1024,
            height: 768,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [BootScene, GameScene],
            pixelArt: true,
            backgroundColor: '#2d2d2d'
        };
        
        this.game = new Phaser.Game(this.config);
        this.game.wyrtGame = this; // Store reference for scenes
    }
    
    async connect() {
        // Determine port based on server selection
        const ports = {
            'tilegame': 8081,
            'ironwood': 8080,
            'arena': 8082
        };
        
        const port = ports[this.server] || 8081;
        const wsUrl = `ws://localhost:${port}`;
        
        this.network = new NetworkManager(wsUrl, this);
        await this.network.connect();
        
        // Authenticate
        await this.network.authenticate(this.username, this.password);
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'init_game':
                this.initializeGame(message);
                break;
                
            case 'state_update':
                this.updateGameState(message.updates);
                break;
                
            case 'player_movement':
                this.updatePlayerMovement(message);
                break;
                
            case 'entity_spawn':
                this.spawnEntity(message.entity);
                break;
                
            case 'entity_remove':
                this.removeEntity(message.entityId);
                break;
                
            case 'entity_move':
                this.updateEntityPosition(message);
                break;
                
            case 'entity_damage':
                this.showDamage(message);
                break;
                
            case 'chat_message':
                this.addChatMessage(message);
                break;
                
            case 'inventory_update':
                this.updateInventory(message.inventory);
                break;
                
            case 'portal_transition':
                this.handlePortalTransition(message);
                break;
        }
    }
    
    initializeGame(data) {
        this.tileMap = data.tileMap;
        this.player = {
            id: data.playerId,
            position: data.playerPosition,
            stats: data.playerStats
        };
        
        // Initialize entities
        for (const entity of data.entities) {
            this.entities.set(entity.id, entity);
        }
        
        // Initialize other players
        for (const player of data.players) {
            this.entities.set(player.id, player);
        }
        
        // Signal game scene to start
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene) {
            gameScene.initializeWorld(data);
        }
    }
    
    updateGameState(updates) {
        for (const update of updates) {
            switch (update.type) {
                case 'player':
                    this.updatePlayerPosition({
                        playerId: update.id,
                        position: update.position
                    });
                    break;
                    
                case 'entity':
                    this.updateEntityPosition({
                        entityId: update.id,
                        position: update.position
                    });
                    break;
            }
        }
    }
    
    updatePlayerMovement(data) {
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene && gameScene.otherPlayers) {
            const player = gameScene.otherPlayers.get(data.playerId);
            if (player) {
                player.updatePosition(data.position, data.velocity, data.facing);
            }
        }
    }
    
    updatePlayerPosition(data) {
        if (data.playerId === this.player.id) {
            // Update local player
            this.player.position = data.position;
        } else {
            // Update other player
            const entity = this.entities.get(data.playerId);
            if (entity) {
                entity.position = data.position;
            }
        }
    }
    
    updateEntityPosition(data) {
        const entity = this.entities.get(data.entityId);
        if (entity) {
            entity.position = data.position;
            
            // Update in game scene
            const gameScene = this.game.scene.getScene('GameScene');
            if (gameScene && gameScene.entities) {
                const sprite = gameScene.entities.get(data.entityId);
                if (sprite) {
                    sprite.setPosition(data.position.x, data.position.y);
                }
            }
        }
    }
    
    spawnEntity(entity) {
        this.entities.set(entity.id, entity);
        
        // Add to game scene
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene) {
            gameScene.spawnEntity(entity);
        }
    }
    
    removeEntity(entityId) {
        this.entities.delete(entityId);
        
        // Remove from game scene
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene) {
            gameScene.removeEntity(entityId);
        }
    }
    
    showDamage(data) {
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene) {
            gameScene.showDamageNumber(data.entityId, data.damage);
        }
    }
    
    addChatMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageEl = document.createElement('div');
            messageEl.innerHTML = `<strong>${message.sender}:</strong> ${message.text}`;
            chatMessages.appendChild(messageEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    updateInventory(inventory) {
        const inventoryEl = document.getElementById('inventory');
        if (inventoryEl) {
            inventoryEl.innerHTML = '';
            
            for (let i = 0; i < 20; i++) {
                const slot = document.createElement('div');
                slot.className = 'inventory-slot';
                
                if (inventory[i]) {
                    const item = inventory[i];
                    slot.innerHTML = `<img src="assets/items/${item.icon}.png" title="${item.name}" />`;
                    if (item.quantity > 1) {
                        slot.innerHTML += `<span class="item-quantity">${item.quantity}</span>`;
                    }
                }
                
                inventoryEl.appendChild(slot);
            }
        }
    }
    
    handlePortalTransition(data) {
        // Reload the map
        const gameScene = this.game.scene.getScene('GameScene');
        if (gameScene) {
            gameScene.loadNewMap(data.toMap, data.position);
        }
    }
    
    sendInput(input) {
        if (this.network) {
            this.network.send({
                type: 'player_input',
                input: input
            });
        }
    }
    
    sendChatMessage(text) {
        if (this.network) {
            this.network.send({
                type: 'chat',
                text: text
            });
        }
    }
    
    updateHealthBar(current, max) {
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            const percentage = (current / max) * 100;
            healthFill.style.width = `${percentage}%`;
        }
    }
    
    updateManaBar(current, max) {
        const manaFill = document.getElementById('mana-fill');
        if (manaFill) {
            const percentage = (current / max) * 100;
            manaFill.style.width = `${percentage}%`;
        }
    }
}

// Global initialization function
window.initGame = function(username, password, server) {
    window.wyrtGame = new WyrtGame(username, password, server);
    window.wyrtGame.connect();
};

// Chat input handler
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && window.wyrtGame) {
                const text = chatInput.value.trim();
                if (text) {
                    window.wyrtGame.sendChatMessage(text);
                    chatInput.value = '';
                }
            }
        });
    }
});