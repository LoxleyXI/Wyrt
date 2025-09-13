class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.otherPlayers = new Map();
        this.entities = new Map();
        this.cursors = null;
        this.wasd = null;
        this.tileMap = null;
        this.tileLayers = [];
        this.inputState = {
            up: false,
            down: false,
            left: false,
            right: false,
            shift: false
        };
        this.lastInputSent = { ...this.inputState };
    }
    
    preload() {
        // Load assets
        this.load.image('tiles', 'assets/tilesets/dungeon.png');
        this.load.spritesheet('player', 'assets/sprites/player.png', { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('slime', 'assets/sprites/slime.png', { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('skeleton', 'assets/sprites/skeleton.png', { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('npc', 'assets/sprites/npc.png', { 
            frameWidth: 32, 
            frameHeight: 32 
        });
    }
    
    create() {
        // Setup input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        
        // Create animations
        this.createAnimations();
        
        // Setup camera
        this.cameras.main.setZoom(2);
        
        // Input event listeners
        this.input.keyboard.on('keydown', (event) => {
            this.handleKeyDown(event.key);
        });
        
        this.input.keyboard.on('keyup', (event) => {
            this.handleKeyUp(event.key);
        });
        
        // Update loop for sending input
        this.time.addEvent({
            delay: 50, // Send input every 50ms
            callback: this.sendInputUpdate,
            callbackScope: this,
            loop: true
        });
    }
    
    createAnimations() {
        // Player animations
        this.anims.create({
            key: 'player_idle_down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
            frameRate: 1,
            repeat: -1
        });
        
        this.anims.create({
            key: 'player_walk_down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        
        this.anims.create({
            key: 'player_walk_up',
            frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        
        this.anims.create({
            key: 'player_walk_left',
            frames: this.anims.generateFrameNumbers('player', { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        
        this.anims.create({
            key: 'player_walk_right',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        
        // Slime animations
        this.anims.create({
            key: 'slime_idle',
            frames: this.anims.generateFrameNumbers('slime', { start: 0, end: 1 }),
            frameRate: 2,
            repeat: -1
        });
        
        // Add more animations as needed
    }
    
    initializeWorld(data) {
        // Clear existing world
        this.clearWorld();
        
        // Create tile map
        if (data.tileMap) {
            this.createTileMap(data.tileMap);
        }
        
        // Create player
        if (data.playerPosition) {
            this.createPlayer(data.playerPosition);
        }
        
        // Create entities
        for (const entity of data.entities) {
            this.spawnEntity(entity);
        }
        
        // Create other players
        for (const player of data.players) {
            this.createOtherPlayer(player);
        }
    }
    
    createTileMap(tileMapData) {
        // Create tilemap
        const map = this.make.tilemap({
            tileWidth: tileMapData.tileSize,
            tileHeight: tileMapData.tileSize,
            width: tileMapData.width,
            height: tileMapData.height
        });
        
        // Add tileset
        const tileset = map.addTilesetImage('tiles');
        
        // Create layers
        for (const layerData of tileMapData.layers) {
            const layer = map.createBlankLayer(layerData.name, tileset);
            
            // Set tile data
            for (let y = 0; y < tileMapData.height; y++) {
                for (let x = 0; x < tileMapData.width; x++) {
                    const tileId = layerData.data[y][x];
                    if (tileId > 0) {
                        layer.putTileAt(tileId, x, y);
                    }
                }
            }
            
            // Set collision if needed
            if (layerData.collision) {
                layer.setCollisionByExclusion([0]);
            }
            
            this.tileLayers.push(layer);
        }
        
        this.tileMap = map;
        
        // Set world bounds
        this.physics.world.setBounds(0, 0, 
            tileMapData.width * tileMapData.tileSize,
            tileMapData.height * tileMapData.tileSize
        );
    }
    
    createPlayer(position) {
        this.player = this.physics.add.sprite(position.x, position.y, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.play('player_idle_down');
        
        // Camera follow player
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setLerp(0.1, 0.1);
        
        // Add collision with tile layers
        for (const layer of this.tileLayers) {
            if (layer.layer.collisionIndexes.length > 0) {
                this.physics.add.collider(this.player, layer);
            }
        }
    }
    
    createOtherPlayer(playerData) {
        const sprite = this.physics.add.sprite(
            playerData.position.x, 
            playerData.position.y, 
            'player'
        );
        
        sprite.playerData = playerData;
        sprite.play('player_idle_down');
        
        // Add name text
        const nameText = this.add.text(
            playerData.position.x, 
            playerData.position.y - 20,
            playerData.name,
            { 
                fontSize: '12px', 
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        nameText.setOrigin(0.5);
        
        sprite.nameText = nameText;
        
        this.otherPlayers.set(playerData.id, sprite);
    }
    
    spawnEntity(entityData) {
        let sprite;
        
        // Choose sprite based on entity type
        switch (entityData.type) {
            case 'npc':
                sprite = this.physics.add.sprite(
                    entityData.position.x,
                    entityData.position.y,
                    'npc'
                );
                break;
                
            case 'mob':
                const mobSprite = entityData.name.toLowerCase().includes('slime') ? 'slime' : 'skeleton';
                sprite = this.physics.add.sprite(
                    entityData.position.x,
                    entityData.position.y,
                    mobSprite
                );
                
                if (mobSprite === 'slime') {
                    sprite.play('slime_idle');
                }
                break;
                
            default:
                sprite = this.physics.add.sprite(
                    entityData.position.x,
                    entityData.position.y,
                    'player'
                );
        }
        
        sprite.entityData = entityData;
        
        // Add name and health bar
        const nameText = this.add.text(
            entityData.position.x,
            entityData.position.y - 20,
            entityData.name,
            {
                fontSize: '10px',
                fill: entityData.type === 'npc' ? '#00ff00' : '#ff0000',
                stroke: '#000000',
                strokeThickness: 1
            }
        );
        nameText.setOrigin(0.5);
        sprite.nameText = nameText;
        
        if (entityData.hp) {
            const healthBar = this.add.graphics();
            sprite.healthBar = healthBar;
            this.updateEntityHealthBar(sprite);
        }
        
        this.entities.set(entityData.id, sprite);
    }
    
    removeEntity(entityId) {
        const sprite = this.entities.get(entityId);
        if (sprite) {
            if (sprite.nameText) sprite.nameText.destroy();
            if (sprite.healthBar) sprite.healthBar.destroy();
            sprite.destroy();
            this.entities.delete(entityId);
        }
    }
    
    updateEntityHealthBar(sprite) {
        if (!sprite.healthBar || !sprite.entityData.hp) return;
        
        const healthPercent = sprite.entityData.hp[0] / sprite.entityData.hp[1];
        const barWidth = 32;
        const barHeight = 4;
        
        sprite.healthBar.clear();
        
        // Background
        sprite.healthBar.fillStyle(0x000000);
        sprite.healthBar.fillRect(
            sprite.x - barWidth / 2,
            sprite.y - 30,
            barWidth,
            barHeight
        );
        
        // Health
        sprite.healthBar.fillStyle(healthPercent > 0.5 ? 0x00ff00 : 
                                  healthPercent > 0.25 ? 0xffff00 : 0xff0000);
        sprite.healthBar.fillRect(
            sprite.x - barWidth / 2,
            sprite.y - 30,
            barWidth * healthPercent,
            barHeight
        );
    }
    
    showDamageNumber(entityId, damage) {
        const sprite = this.entities.get(entityId) || 
                       (entityId === this.game.wyrtGame.player.id ? this.player : null);
        
        if (!sprite) return;
        
        const damageText = this.add.text(
            sprite.x + Phaser.Math.Between(-10, 10),
            sprite.y - 20,
            `-${damage}`,
            {
                fontSize: '14px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 2,
                fontStyle: 'bold'
            }
        );
        damageText.setOrigin(0.5);
        
        // Animate damage number
        this.tweens.add({
            targets: damageText,
            y: damageText.y - 30,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                damageText.destroy();
            }
        });
    }
    
    handleKeyDown(key) {
        let changed = false;
        
        switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                if (!this.inputState.up) {
                    this.inputState.up = true;
                    changed = true;
                }
                break;
            case 's':
            case 'arrowdown':
                if (!this.inputState.down) {
                    this.inputState.down = true;
                    changed = true;
                }
                break;
            case 'a':
            case 'arrowleft':
                if (!this.inputState.left) {
                    this.inputState.left = true;
                    changed = true;
                }
                break;
            case 'd':
            case 'arrowright':
                if (!this.inputState.right) {
                    this.inputState.right = true;
                    changed = true;
                }
                break;
            case 'shift':
                if (!this.inputState.shift) {
                    this.inputState.shift = true;
                    changed = true;
                }
                break;
        }
        
        if (changed) {
            this.sendInputUpdate();
        }
    }
    
    handleKeyUp(key) {
        let changed = false;
        
        switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                if (this.inputState.up) {
                    this.inputState.up = false;
                    changed = true;
                }
                break;
            case 's':
            case 'arrowdown':
                if (this.inputState.down) {
                    this.inputState.down = false;
                    changed = true;
                }
                break;
            case 'a':
            case 'arrowleft':
                if (this.inputState.left) {
                    this.inputState.left = false;
                    changed = true;
                }
                break;
            case 'd':
            case 'arrowright':
                if (this.inputState.right) {
                    this.inputState.right = false;
                    changed = true;
                }
                break;
            case 'shift':
                if (this.inputState.shift) {
                    this.inputState.shift = false;
                    changed = true;
                }
                break;
        }
        
        if (changed) {
            this.sendInputUpdate();
        }
    }
    
    sendInputUpdate() {
        // Only send if input changed
        if (JSON.stringify(this.inputState) !== JSON.stringify(this.lastInputSent)) {
            this.game.wyrtGame.sendInput({
                type: 'movement',
                keys: { ...this.inputState }
            });
            this.lastInputSent = { ...this.inputState };
        }
    }
    
    update(time, delta) {
        // Update other players
        for (const [id, sprite] of this.otherPlayers) {
            if (sprite.nameText) {
                sprite.nameText.setPosition(sprite.x, sprite.y - 20);
            }
        }
        
        // Update entities
        for (const [id, sprite] of this.entities) {
            if (sprite.nameText) {
                sprite.nameText.setPosition(sprite.x, sprite.y - 20);
            }
            if (sprite.healthBar) {
                this.updateEntityHealthBar(sprite);
            }
        }
    }
    
    clearWorld() {
        // Clear players
        for (const [id, sprite] of this.otherPlayers) {
            if (sprite.nameText) sprite.nameText.destroy();
            sprite.destroy();
        }
        this.otherPlayers.clear();
        
        // Clear entities
        for (const [id, sprite] of this.entities) {
            if (sprite.nameText) sprite.nameText.destroy();
            if (sprite.healthBar) sprite.healthBar.destroy();
            sprite.destroy();
        }
        this.entities.clear();
        
        // Clear tile layers
        for (const layer of this.tileLayers) {
            layer.destroy();
        }
        this.tileLayers = [];
        
        // Clear player
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
    }
    
    loadNewMap(mapId, position) {
        // Request new map data from server
        this.game.wyrtGame.network.send({
            type: 'request_map',
            mapId: mapId
        });
    }
}