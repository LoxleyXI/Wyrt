import * as Phaser from "phaser";
import { useGameStore } from "@/store/gameStore";
import { getSocket } from "@/lib/ctfSocket";

export default class GameScene extends Phaser.Scene {
  private socket: any;
  private myPlayerId: string | null = null;

  // Sprite maps
  private playerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private flagSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private weaponSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private projectileSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private baseSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private collisionBlocks: Phaser.GameObjects.Rectangle[] = [];

  // Input
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: any;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private eKey?: Phaser.Input.Keyboard.Key;
  private fKey?: Phaser.Input.Keyboard.Key;

  // Movement
  private lastMoveTime: number = 0;
  private moveSendInterval: number = 30; // Send movement every 30ms

  // Heartbeat to prevent disconnect when idle
  private lastHeartbeatTime: number = 0;
  private heartbeatInterval: number = 5000; // Send heartbeat every 5 seconds

  // Pickup debouncing
  private lastFlagPickupAttempt: number = 0;
  private lastWeaponPickupAttempt: number = 0;
  private pickupCooldown: number = 500; // 500ms cooldown between pickup attempts

  // Map initialization
  private mapInitialized: boolean = false;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    console.log("[GameScene] Creating scene");

    // Store global reference for triggering effects from React
    (window as any).gameScene = this;

    // Get socket
    this.socket = getSocket();

    // Set up world bounds based on map
    const mapConfig = useGameStore.getState().mapConfig;
    if (mapConfig) {
      const worldWidth = mapConfig.width * mapConfig.tileSize;
      const worldHeight = mapConfig.height * mapConfig.tileSize;
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

      // Create background
      this.createBackground(mapConfig);

      // Create base markers
      this.createBases(mapConfig);

      // Create collision blocks
      this.createCollisionBlocks(mapConfig);
    }

    // Set up input
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.fKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // Set up camera
    this.cameras.main.setBounds(0, 0, mapConfig ? mapConfig.width * mapConfig.tileSize : 800, mapConfig ? mapConfig.height * mapConfig.tileSize : 592);

    console.log("[GameScene] Scene created");
  }

  private initializeMap() {
    if (this.mapInitialized) return;

    const mapConfig = useGameStore.getState().mapConfig;
    if (!mapConfig) return;

    // Set up world bounds
    const worldWidth = mapConfig.width * mapConfig.tileSize;
    const worldHeight = mapConfig.height * mapConfig.tileSize;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Create visual elements
    this.createBackground(mapConfig);
    this.createBases(mapConfig);
    this.createCollisionBlocks(mapConfig);

    // Update camera bounds
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.mapInitialized = true;
  }

  update(time: number, delta: number) {
    // Initialize map if not already done (handles race condition with WebSocket)
    this.initializeMap();

    const state = useGameStore.getState();
    const { gameState, myPlayer } = state;

    if (!gameState || !myPlayer) return;

    // Store player ID
    if (!this.myPlayerId && state.playerId) {
      this.myPlayerId = state.playerId;
    }

    // Handle input for local player
    this.handlePlayerInput(myPlayer);

    // Update all players
    this.updatePlayers(gameState);

    // Update flags
    this.updateFlags(gameState);

    // Update weapons
    this.updateWeapons(gameState);

    // Update projectiles
    this.updateProjectiles(gameState);

    // Update camera to follow local player
    const mySprite = this.playerSprites.get(myPlayer.id);
    if (mySprite) {
      this.cameras.main.startFollow(mySprite, true, 0.1, 0.1);
    }
  }

  private createBackground(mapConfig: any) {
    // Create tiled background
    for (let y = 0; y < mapConfig.height; y++) {
      for (let x = 0; x < mapConfig.width; x++) {
        const tile = this.add.image(
          x * mapConfig.tileSize + mapConfig.tileSize / 2,
          y * mapConfig.tileSize + mapConfig.tileSize / 2,
          "tile"
        );
        tile.setDisplaySize(mapConfig.tileSize, mapConfig.tileSize);
      }
    }
  }

  private createBases(mapConfig: any) {
    // Red base
    const redBase = this.add.sprite(
      mapConfig.bases.red.position.x,
      mapConfig.bases.red.position.y,
      "base_red"
    );
    redBase.setAlpha(0.5);
    this.baseSprites.set("red", redBase);

    // Blue base
    const blueBase = this.add.sprite(
      mapConfig.bases.blue.position.x,
      mapConfig.bases.blue.position.y,
      "base_blue"
    );
    blueBase.setAlpha(0.5);
    this.baseSprites.set("blue", blueBase);

    // Add base labels
    this.add.text(
      mapConfig.bases.red.position.x,
      mapConfig.bases.red.position.y - 30,
      "RED BASE",
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      }
    ).setOrigin(0.5);

    this.add.text(
      mapConfig.bases.blue.position.x,
      mapConfig.bases.blue.position.y - 30,
      "BLUE BASE",
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      }
    ).setOrigin(0.5);
  }

  private createCollisionBlocks(mapConfig: any) {
    if (!mapConfig.collisionLayer) return;

    for (const block of mapConfig.collisionLayer) {
      // Create a dark gray rectangle for the collision block
      const rect = this.add.rectangle(
        block.x + block.width / 2,
        block.y + block.height / 2,
        block.width,
        block.height,
        0x444444,
        1
      );
      rect.setStrokeStyle(2, 0x222222);
      rect.setDepth(1); // Ensure walls appear above background
      this.collisionBlocks.push(rect);
    }
  }

  private handlePlayerInput(myPlayer: any) {
    if (!this.cursors || !this.wasd) return;

    // Can't move if stunned
    if (myPlayer.stunned) return;

    const moveSpeed = myPlayer.activeBoost === "speed" ? 350 : 240;
    let moving = false;
    let newX = myPlayer.position.x;
    let newY = myPlayer.position.y;
    let direction = myPlayer.direction;

    // Can't move if dead or stunned
    if (myPlayer.respawning || myPlayer.stunned) {
      return;
    }

    // Handle movement
    if (this.cursors.left?.isDown || this.wasd.left?.isDown) {
      newX -= moveSpeed * 0.016; // Approximate delta time
      direction = "left";
      moving = true;
    } else if (this.cursors.right?.isDown || this.wasd.right?.isDown) {
      newX += moveSpeed * 0.016;
      direction = "right";
      moving = true;
    }

    if (this.cursors.up?.isDown || this.wasd.up?.isDown) {
      newY -= moveSpeed * 0.016;
      direction = "up";
      moving = true;
    } else if (this.cursors.down?.isDown || this.wasd.down?.isDown) {
      newY += moveSpeed * 0.016;
      direction = "down";
      moving = true;
    }

    // Clamp to world bounds
    const mapConfig = useGameStore.getState().mapConfig;
    if (mapConfig) {
      newX = Phaser.Math.Clamp(newX, 16, mapConfig.width * mapConfig.tileSize - 16);
      newY = Phaser.Math.Clamp(newY, 16, mapConfig.height * mapConfig.tileSize - 16);
    }

    // Check collision with walls (client-side) - allow sliding
    const PLAYER_RADIUS = 16;
    if (moving) {
      // Try full movement first
      if (this.isPositionInCollisionBlock(newX, newY, PLAYER_RADIUS)) {
        // Try X-only movement (slide along Y axis)
        if (!this.isPositionInCollisionBlock(newX, myPlayer.position.y, PLAYER_RADIUS)) {
          newY = myPlayer.position.y;
        }
        // Try Y-only movement (slide along X axis)
        else if (!this.isPositionInCollisionBlock(myPlayer.position.x, newY, PLAYER_RADIUS)) {
          newX = myPlayer.position.x;
        }
        // Can't move at all
        else {
          return;
        }
      }
    }

    // Send movement to server (throttled)
    if (moving) {
      const now = Date.now();
      if (now - this.lastMoveTime > this.moveSendInterval) {
        this.socket.move({ x: newX, y: newY }, direction);
        this.lastMoveTime = now;

        // Update local position immediately for responsiveness
        useGameStore.getState().updatePlayer(myPlayer.id, {
          position: { x: newX, y: newY },
          direction,
        });
      }
    }

    // Handle shooting (Space key)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey!)) {
      // Calculate shoot direction based on player direction
      const shootDir = this.getDirectionVector(direction);
      this.socket.shoot(shootDir);
    }

    // E key no longer needed - boosts auto-activate on pickup

    // Auto-pickup enemy flag OR return own flag when near it (with cooldown to prevent spam)
    const now = Date.now();

    // Check for enemy flag pickup
    const enemyTeam = myPlayer.team === "red" ? "blue" : "red";
    const enemyFlag = useGameStore.getState().gameState?.flags[enemyTeam];

    if (enemyFlag && enemyFlag.state !== "carried" && !myPlayer.carryingFlag) {
      // Check if player is near enemy flag
      const dist = Phaser.Math.Distance.Between(
        myPlayer.position.x,
        myPlayer.position.y,
        enemyFlag.position.x,
        enemyFlag.position.y
      );

      if (dist < 32 && now - this.lastFlagPickupAttempt > this.pickupCooldown) {
        this.socket.pickupFlag(enemyTeam);
        this.lastFlagPickupAttempt = now;
      }
    }

    // Check for own flag return
    const ownTeam = myPlayer.team;
    const ownFlag = useGameStore.getState().gameState?.flags[ownTeam as 'red' | 'blue'];

    if (ownFlag && ownFlag.state === "dropped") {
      // Check if player is near own flag
      const dist = Phaser.Math.Distance.Between(
        myPlayer.position.x,
        myPlayer.position.y,
        ownFlag.position.x,
        ownFlag.position.y
      );

      if (dist < 32 && now - this.lastFlagPickupAttempt > this.pickupCooldown) {
        this.socket.pickupFlag(ownTeam);
        this.lastFlagPickupAttempt = now;
      }
    }

    // Auto-pickup weapons when near them (with cooldown to prevent spam)
    const weapons = useGameStore.getState().gameState?.weapons || [];
    for (const weapon of weapons) {
      // Skip weapons without spawnPosition (shouldn't happen but safety check)
      if (!weapon.spawnPosition) continue;

      if (!weapon.pickedUpBy && now - this.lastWeaponPickupAttempt > this.pickupCooldown) {
        const dist = Phaser.Math.Distance.Between(
          myPlayer.position.x,
          myPlayer.position.y,
          weapon.spawnPosition.x,
          weapon.spawnPosition.y
        );

        if (dist < 32) {
          this.socket.pickupWeapon(weapon.id);
          this.lastWeaponPickupAttempt = now;
          break; // Only pick up one weapon per frame
        }
      }
    }

    // Send heartbeat to prevent disconnect when idle
    if (now - this.lastHeartbeatTime > this.heartbeatInterval) {
      // Send current position as heartbeat (updates lastActivityTime on server)
      this.socket.move(myPlayer.position, myPlayer.direction);
      this.lastHeartbeatTime = now;
    }
  }

  private getDirectionVector(direction: string): { x: number; y: number } {
    switch (direction) {
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      default:
        return { x: 0, y: 1 };
    }
  }

  private updatePlayers(gameState: any) {
    const players = gameState.players;

    // Create/update sprites for all players
    for (const player of players) {
      let sprite = this.playerSprites.get(player.id);

      if (!sprite) {
        // Create new sprite
        const texKey = player.team === "red" ? "player_red" : "player_blue";
        sprite = this.add.sprite(player.position.x, player.position.y, texKey);
        this.playerSprites.set(player.id, sprite);

        // Add name label
        const nameText = this.add.text(0, -24, player.name, {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: { x: 6, y: 3 },
        }).setOrigin(0.5);

        sprite.setData("nameText", nameText);
      }

      // Update position
      sprite.setPosition(player.position.x, player.position.y);

      // Update name label position
      const nameText = sprite.getData("nameText");
      if (nameText) {
        nameText.setPosition(player.position.x, player.position.y - 24);
      }

      // Handle respawning state - make player invisible and show timer
      if (player.respawning) {
        // Check if player just died (was alive last frame)
        const wasRespawning = sprite.getData("wasRespawning");
        if (!wasRespawning) {
          // Just died! Show death animation
          this.showDeathAnimation(player.position);
          sprite.setData("wasRespawning", true);
        }

        sprite.setVisible(false);
        if (nameText) nameText.setVisible(false);

        // Show respawn timer
        let respawnText = sprite.getData("respawnText");
        if (!respawnText) {
          respawnText = this.add.text(0, 0, "", {
            fontFamily: "Arial, sans-serif",
            fontSize: "32px",
            fontStyle: "bold",
            color: "#ff0000",
            stroke: "#000000",
            strokeThickness: 4,
          }).setOrigin(0.5);
          sprite.setData("respawnText", respawnText);
        }

        const timeLeft = Math.ceil((player.respawnAt - Date.now()) / 1000);
        respawnText.setText(`${timeLeft}`);
        respawnText.setPosition(player.position.x, player.position.y);
        respawnText.setVisible(true);

        // Hide boost circles during respawn
        const speedCircle = sprite.getData("speedCircle");
        const shieldCircle = sprite.getData("shieldCircle");
        if (speedCircle) speedCircle.setVisible(false);
        if (shieldCircle) shieldCircle.setVisible(false);

        continue;  // Skip remaining visual updates
      } else {
        sprite.setVisible(true);
        if (nameText) nameText.setVisible(true);
        sprite.setData("wasRespawning", false);

        // Hide respawn timer when alive
        const respawnText = sprite.getData("respawnText");
        if (respawnText) respawnText.setVisible(false);
      }

      // Visual effects for status
      if (player.stunned) {
        sprite.setTint(0x888888);
      } else if (player.carryingFlag) {
        // Tint with enemy flag color
        const enemyColor = player.team === "red" ? 0x0000ff : 0xff0000;
        sprite.setTint(enemyColor);
      } else {
        sprite.clearTint();
      }

      // Boost visual effects (separate from tint)
      // Show speed boost circle (green) - check hasSpeed flag
      let speedCircle = sprite.getData("speedCircle");
      if (player.hasSpeed) {
        if (!speedCircle) {
          speedCircle = this.add.circle(0, 0, 20, 0xffffff, 0);
          sprite.setData("speedCircle", speedCircle);
        }
        speedCircle.setPosition(player.position.x, player.position.y);
        const pulse = 20 + Math.sin(Date.now() / 100) * 3;
        speedCircle.setRadius(pulse);
        speedCircle.setStrokeStyle(2, 0x00ff00, 0.8);
        speedCircle.setVisible(true);
      } else if (speedCircle) {
        speedCircle.setVisible(false);
      }

      // Show shield boost circle (cyan) - check hasShield flag
      let shieldCircle = sprite.getData("shieldCircle");
      if (player.hasShield) {
        if (!shieldCircle) {
          shieldCircle = this.add.circle(0, 0, 26, 0xffffff, 0);
          sprite.setData("shieldCircle", shieldCircle);
        }
        shieldCircle.setPosition(player.position.x, player.position.y);
        const pulse = 26 + Math.sin(Date.now() / 100) * 3;
        shieldCircle.setRadius(pulse);
        shieldCircle.setStrokeStyle(2, 0x00ffff, 0.8);
        shieldCircle.setVisible(true);
      } else if (shieldCircle) {
        shieldCircle.setVisible(false);
      }

      // Rotation based on direction
      switch (player.direction) {
        case "up":
          sprite.setRotation(0);
          break;
        case "down":
          sprite.setRotation(Math.PI);
          break;
        case "left":
          sprite.setRotation(-Math.PI / 2);
          break;
        case "right":
          sprite.setRotation(Math.PI / 2);
          break;
      }
    }

    // Remove sprites for players that left
    const currentPlayerIds = new Set(players.map((p: any) => p.id));
    for (const [playerId, sprite] of this.playerSprites.entries()) {
      if (!currentPlayerIds.has(playerId)) {
        const nameText = sprite.getData("nameText");
        if (nameText) nameText.destroy();
        const boostCircle = sprite.getData("boostCircle");
        if (boostCircle) boostCircle.destroy();
        sprite.destroy();
        this.playerSprites.delete(playerId);
      }
    }
  }

  private updateFlags(gameState: any) {
    const flags = gameState.flags;

    for (const [team, flag] of Object.entries(flags) as any) {
      let sprite = this.flagSprites.get(team);

      // Only show flag if it's at base or dropped
      const shouldShow = flag.state === "at_base" || flag.state === "dropped";

      if (shouldShow) {
        if (!sprite) {
          const texKey = `flag_${team}`;
          sprite = this.add.sprite(flag.position.x, flag.position.y, texKey);
          this.flagSprites.set(team, sprite);
        }

        sprite.setPosition(flag.position.x, flag.position.y);
        sprite.setVisible(true);

        // Pulse animation if dropped
        if (flag.state === "dropped") {
          sprite.setAlpha(0.5 + Math.sin(Date.now() / 200) * 0.3);
        } else {
          sprite.setAlpha(1);
        }
      } else {
        // Flag is carried, hide it
        if (sprite) {
          sprite.setVisible(false);
        }
      }
    }
  }

  private updateWeapons(gameState: any) {
    const weapons = gameState.weapons || [];

    for (const weapon of weapons) {
      let sprite = this.weaponSprites.get(weapon.id);

      // Only show weapon if not picked up
      const shouldShow = !weapon.pickedUpBy;

      if (shouldShow) {
        if (!sprite) {
          // Create shadow
          const shadow = this.add.ellipse(
            weapon.spawnPosition.x,
            weapon.spawnPosition.y + 4,
            20,
            8,
            0x000000,
            0.4
          );

          // Create weapon sprite (oval shape)
          const weaponSprite = this.add.ellipse(
            weapon.spawnPosition.x,
            weapon.spawnPosition.y,
            24,
            24,
            this.getWeaponColor(weapon.type)
          );

          // Store both in a container-like structure
          weaponSprite.setData("shadow", shadow);

          this.weaponSprites.set(weapon.id, weaponSprite);
          sprite = weaponSprite;
        }

        sprite.setVisible(true);
        const shadow = sprite.getData("shadow");
        if (shadow) shadow.setVisible(true);

        // Floating animation
        const offset = Math.sin(Date.now() / 300) * 3;
        sprite.setPosition(weapon.spawnPosition.x, weapon.spawnPosition.y + offset);
        if (shadow) {
          shadow.setPosition(weapon.spawnPosition.x, weapon.spawnPosition.y + offset + 4);
        }
      } else {
        // Weapon is picked up, hide it
        if (sprite) {
          sprite.setVisible(false);
          const shadow = sprite.getData("shadow");
          if (shadow) shadow.setVisible(false);
        }
      }
    }

    // Clean up weapons that no longer exist
    const currentWeaponIds = new Set(weapons.map((w: any) => w.id));
    for (const [weaponId, sprite] of this.weaponSprites.entries()) {
      if (!currentWeaponIds.has(weaponId)) {
        const shadow = sprite.getData("shadow");
        if (shadow) shadow.destroy();
        sprite.destroy();
        this.weaponSprites.delete(weaponId);
      }
    }
  }

  private getWeaponColor(type: string): number {
    switch (type) {
      case "stun_gun":
        return 0xffff00; // Yellow
      case "speed_boost":
        return 0x00ff00; // Green
      case "shield":
        return 0x00ffff; // Cyan
      default:
        return 0xffffff; // White
    }
  }

  private updateProjectiles(gameState: any) {
    const projectiles = gameState.projectiles || [];

    // Create/update projectile sprites
    for (const projectile of projectiles) {
      let sprite = this.projectileSprites.get(projectile.id);

      if (!sprite) {
        // Create a glowing projectile circle
        const projectileGraphic = this.add.circle(
          projectile.position.x,
          projectile.position.y,
          6,
          0xffff00,
          1
        ) as any;

        // Add a glow effect
        projectileGraphic.setStrokeStyle(2, 0xffffff, 0.8);

        this.projectileSprites.set(projectile.id, projectileGraphic);
        sprite = projectileGraphic;
      }

      const newX = projectile.position.x + projectile.velocity.x * 0.016;
      const newY = projectile.position.y + projectile.velocity.y * 0.016;

      if (this.isPositionInCollisionBlock(newX, newY, 8)) {
        this.showProjectileSplash({ x: newX, y: newY });
        if (sprite) {
          sprite.destroy();
        }
        this.projectileSprites.delete(projectile.id);
        useGameStore.getState().removeProjectile(projectile.id);
        continue;
      }

      if (sprite) {
        sprite.setPosition(newX, newY);
      }

      projectile.position.x = newX;
      projectile.position.y = newY;

      const age = Date.now() - projectile.createdAt;
      if (age > 3000) {
        if (sprite) {
          sprite.destroy();
        }
        this.projectileSprites.delete(projectile.id);
        useGameStore.getState().removeProjectile(projectile.id);
      }
    }

    // Clean up destroyed projectiles
    const currentProjectileIds = new Set(projectiles.map((p: any) => p.id));
    for (const [id, sprite] of this.projectileSprites.entries()) {
      if (!currentProjectileIds.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  /**
   * Show death animation when player is killed
   */
  showDeathAnimation(position: { x: number; y: number }) {
    // Create expanding red circle
    const deathCircle = this.add.circle(position.x, position.y, 10, 0xff0000, 0.8);

    // Animate: expand and fade out
    this.tweens.add({
      targets: deathCircle,
      radius: 50,
      alpha: 0,
      duration: 500,
      ease: "Power2",
      onComplete: () => {
        deathCircle.destroy();
      },
    });

    // Add some particle effects
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(
        position.x,
        position.y,
        4,
        0xff4444,
        1
      );

      this.tweens.add({
        targets: particle,
        x: position.x + Math.cos(angle) * 40,
        y: position.y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 400,
        ease: "Power2",
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  /**
   * Show projectile splash effect when hitting wall
   */
  showProjectileSplash(position: { x: number; y: number }) {
    // Create small expanding circle at impact point
    const splashCircle = this.add.circle(position.x, position.y, 8, 0xffaa00, 0.8);

    // Animate: expand and fade out quickly
    this.tweens.add({
      targets: splashCircle,
      radius: 20,
      alpha: 0,
      duration: 250,
      ease: "Power2",
      onComplete: () => {
        splashCircle.destroy();
      },
    });

    // Add small particle sparks
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const particle = this.add.circle(
        position.x,
        position.y,
        3,
        0xffcc44,
        1
      );

      this.tweens.add({
        targets: particle,
        x: position.x + Math.cos(angle) * 25,
        y: position.y + Math.sin(angle) * 25,
        alpha: 0,
        duration: 300,
        ease: "Power2",
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  /**
   * Check if a position collides with any collision blocks
   */
  private isPositionInCollisionBlock(x: number, y: number, radius: number): boolean {
    const mapConfig = useGameStore.getState().mapConfig;
    if (!mapConfig || !mapConfig.collisionLayer) return false;

    for (const block of mapConfig.collisionLayer) {
      // Find closest point on rectangle to the circle
      const closestX = Phaser.Math.Clamp(x, block.x, block.x + block.width);
      const closestY = Phaser.Math.Clamp(y, block.y, block.y + block.height);

      // Calculate distance from circle center to closest point
      const distanceX = x - closestX;
      const distanceY = y - closestY;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;

      // Check if distance is less than radius (collision)
      if (distanceSquared < radius * radius) {
        return true;
      }
    }

    return false;
  }
}
