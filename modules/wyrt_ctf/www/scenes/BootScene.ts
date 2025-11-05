import * as Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Create loading text
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const loadingText = this.add.text(width / 2, height / 2, "Loading CTF...", {
      font: "20px Arial",
      color: "#ffffff",
    });
    loadingText.setOrigin(0.5, 0.5);

    // Since we don't have actual assets yet, we'll generate placeholder graphics
    this.createPlaceholderSprites();

    // Load any actual assets here when available
    // this.load.image('tile', 'assets/tile.png');
    // this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    // Start the main game scene
    this.scene.start("GameScene");
  }

  /**
   * Create placeholder sprites using graphics
   */
  private createPlaceholderSprites() {
    // Player sprites - Red team
    this.createPlayerSprite("player_red", 0xff3333);

    // Player sprites - Blue team
    this.createPlayerSprite("player_blue", 0x3333ff);

    // Flags
    this.createFlagSprite("flag_red", 0xff0000);
    this.createFlagSprite("flag_blue", 0x0000ff);

    // Weapons/Pickups
    this.createPickupSprite("stun_gun", 0xffff00, "🔫");
    this.createPickupSprite("speed_boost", 0x00ff00, "⚡");
    this.createPickupSprite("shield", 0x00ffff, "🛡️");

    // Projectile
    this.createProjectileSprite();

    // Floor tile
    this.createTile();

    // Base markers
    this.createBaseSprite("base_red", 0xff0000);
    this.createBaseSprite("base_blue", 0x0000ff);
  }

  private createPlayerSprite(key: string, color: number) {
    const graphics = this.add.graphics();

    // Draw player as circle
    graphics.fillStyle(color, 1);
    graphics.fillCircle(16, 16, 12);

    // Add direction indicator (triangle)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(16, 8, 12, 12, 20, 12);

    graphics.generateTexture(key, 32, 32);
    graphics.destroy();
  }

  private createFlagSprite(key: string, color: number) {
    const graphics = this.add.graphics();

    // Flag pole
    graphics.fillStyle(0x666666, 1);
    graphics.fillRect(14, 4, 2, 20);

    // Flag cloth
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(16, 6);
    graphics.lineTo(26, 11);
    graphics.lineTo(16, 16);
    graphics.closePath();
    graphics.fillPath();

    graphics.generateTexture(key, 32, 32);
    graphics.destroy();
  }

  private createPickupSprite(key: string, color: number, emoji: string) {
    const graphics = this.add.graphics();

    // Background circle
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(16, 16, 10);

    // Border
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(16, 16, 10);

    graphics.generateTexture(key, 32, 32);
    graphics.destroy();

    // Add emoji text overlay if needed
    const text = this.add.text(16, 16, emoji, {
      fontSize: '16px',
    }).setOrigin(0.5);
    text.setVisible(false);
  }

  private createProjectileSprite() {
    const graphics = this.add.graphics();

    // Projectile as small yellow circle
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(8, 8, 6);

    // Add glow effect
    graphics.fillStyle(0xffff00, 0.5);
    graphics.fillCircle(8, 8, 8);

    graphics.generateTexture("projectile", 16, 16);
    graphics.destroy();
  }

  private createTile() {
    const graphics = this.add.graphics();

    // Floor tile with grid
    graphics.fillStyle(0x3a3a3a, 1);
    graphics.fillRect(0, 0, 16, 16);

    // Grid lines
    graphics.lineStyle(1, 0x2a2a2a, 0.5);
    graphics.strokeRect(0, 0, 16, 16);

    graphics.generateTexture("tile", 16, 16);
    graphics.destroy();
  }

  private createBaseSprite(key: string, color: number) {
    const graphics = this.add.graphics();

    // Base as large semi-transparent circle
    graphics.fillStyle(color, 0.3);
    graphics.fillCircle(24, 24, 20);

    // Border
    graphics.lineStyle(3, color, 0.8);
    graphics.strokeCircle(24, 24, 20);

    graphics.generateTexture(key, 48, 48);
    graphics.destroy();
  }
}
