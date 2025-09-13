class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }
    
    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        const percentText = this.make.text({
            x: width / 2,
            y: height / 2,
            text: '0%',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);
        
        const assetText = this.make.text({
            x: width / 2,
            y: height / 2 + 50,
            text: '',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        assetText.setOrigin(0.5, 0.5);
        
        // Update loading bar
        this.load.on('progress', (value) => {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
        
        this.load.on('fileprogress', (file) => {
            assetText.setText('Loading asset: ' + file.key);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            assetText.destroy();
            
            this.scene.start('GameScene');
        });
        
        // Load placeholder assets if real ones don't exist
        this.createPlaceholderAssets();
    }
    
    create() {
        // Boot scene setup complete
    }
    
    createPlaceholderAssets() {
        // Create placeholder textures if assets are missing
        
        // Create a simple colored square for missing sprites
        const graphics = this.add.graphics();
        
        // Player placeholder
        graphics.fillStyle(0x00ff00);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('player_placeholder', 32, 32);
        
        // Slime placeholder
        graphics.clear();
        graphics.fillStyle(0x00ff99);
        graphics.fillCircle(16, 16, 14);
        graphics.generateTexture('slime_placeholder', 32, 32);
        
        // Skeleton placeholder
        graphics.clear();
        graphics.fillStyle(0xcccccc);
        graphics.fillRect(8, 0, 16, 32);
        graphics.generateTexture('skeleton_placeholder', 32, 32);
        
        // NPC placeholder
        graphics.clear();
        graphics.fillStyle(0xffff00);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('npc_placeholder', 32, 32);
        
        // Tile placeholder
        graphics.clear();
        graphics.lineStyle(1, 0x333333);
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if ((x + y) % 2 === 0) {
                    graphics.fillStyle(0x555555);
                } else {
                    graphics.fillStyle(0x444444);
                }
                graphics.fillRect(x * 32, y * 32, 32, 32);
                graphics.strokeRect(x * 32, y * 32, 32, 32);
            }
        }
        graphics.generateTexture('tiles_placeholder', 320, 320);
        
        graphics.destroy();
        
        // Use placeholders if real assets fail to load
        this.load.on('loaderror', (file) => {
            console.warn(`Failed to load ${file.key}, using placeholder`);
            
            switch (file.key) {
                case 'player':
                    this.textures.addSpriteSheet('player', 
                        this.textures.get('player_placeholder').getSourceImage(), {
                        frameWidth: 32,
                        frameHeight: 32
                    });
                    break;
                case 'slime':
                    this.textures.addSpriteSheet('slime', 
                        this.textures.get('slime_placeholder').getSourceImage(), {
                        frameWidth: 32,
                        frameHeight: 32
                    });
                    break;
                case 'skeleton':
                    this.textures.addSpriteSheet('skeleton', 
                        this.textures.get('skeleton_placeholder').getSourceImage(), {
                        frameWidth: 32,
                        frameHeight: 32
                    });
                    break;
                case 'npc':
                    this.textures.addSpriteSheet('npc', 
                        this.textures.get('npc_placeholder').getSourceImage(), {
                        frameWidth: 32,
                        frameHeight: 32
                    });
                    break;
                case 'tiles':
                    this.textures.addImage('tiles', 
                        this.textures.get('tiles_placeholder').getSourceImage());
                    break;
            }
        });
    }
}