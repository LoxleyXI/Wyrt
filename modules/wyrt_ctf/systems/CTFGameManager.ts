/**
 * CTF game loop and state management.
 */

import { CTFGameState, CTFPlayer, MapConfig, Team, Position, Direction } from '../types/CTFTypes';
import { FlagManager } from './FlagManager';
import { ModuleContext } from '../../../src/module/IModule';
import { TeamManager } from '../../wyrt_teams/systems/TeamManager';
import { PickupManager } from '../../wyrt_pickups/systems/PickupManager';
import { ProjectileManager } from '../../wyrt_projectiles/systems/ProjectileManager';
import { BuffManager } from '../../wyrt_buffs/systems/BuffManager';
import { RespawnManager } from '../../wyrt_respawn/systems/RespawnManager';

const GAME_UPDATE_RATE = 60;  // Updates per second
const CAPTURE_LIMIT = 3;  // First to 3 wins

export class CTFGameManager {
    private context: ModuleContext;
    private gameState: CTFGameState;
    private mapConfig: MapConfig;

    // Subsystems
    private teams: TeamManager;
    private pickups: PickupManager;
    private projectiles: ProjectileManager;
    private buffs: BuffManager;
    private respawn: RespawnManager;
    private flagManager: FlagManager;

    // Game loop
    private gameLoopInterval: NodeJS.Timeout | null = null;
    private lastUpdateTime: number = Date.now();

    constructor(context: ModuleContext, mapConfig: MapConfig) {
        this.context = context;
        this.mapConfig = mapConfig;

        // Initialize game state
        this.gameState = {
            matchId: `match_${Date.now()}`,
            status: 'waiting',
            scores: { red: 0, blue: 0 },
            captureLimit: CAPTURE_LIMIT,
            flags: {
                red: {
                    team: 'red',
                    state: 'at_base',
                    position: mapConfig.bases.red.position,
                    carriedBy: null,
                    droppedAt: null
                },
                blue: {
                    team: 'blue',
                    state: 'at_base',
                    position: mapConfig.bases.blue.position,
                    carriedBy: null,
                    droppedAt: null
                }
            },
            players: new Map(),
            weapons: new Map(),
            projectiles: new Map(),
            startedAt: null,
            endedAt: null,
            winnerId: null
        };

        // Get core module managers
        this.teams = context.getModule('wyrt_teams').createTeamManager('ctf');
        this.pickups = context.getModule('wyrt_pickups').createPickupManager('ctf');
        this.projectiles = context.getModule('wyrt_projectiles').createProjectileManager('ctf');
        this.buffs = context.getModule('wyrt_buffs').createBuffManager('ctf');
        this.respawn = context.getModule('wyrt_respawn').createRespawnManager('ctf');

        // Initialize CTF-specific systems
        this.flagManager = new FlagManager(this.gameState.flags, this.gameState.scores);

        // Register spawn points for each team
        this.respawn.registerSpawnPoints('red', {
            spawnPoints: mapConfig.bases.red.spawnPoints,
            selectionMode: 'random'
        });
        this.respawn.registerSpawnPoints('blue', {
            spawnPoints: mapConfig.bases.blue.spawnPoints,
            selectionMode: 'random'
        });

        // Create teams
        this.teams.createTeam({
            id: 'red',
            name: 'Red Team',
            color: '#FF0000'
        });
        this.teams.createTeam({
            id: 'blue',
            name: 'Blue Team',
            color: '#0000FF'
        });

        // Register weapon pickups
        for (const weaponSpawn of mapConfig.weaponSpawns) {
            const pickup = this.pickups.registerPickup({
                id: `weapon_${weaponSpawn.position.x}_${weaponSpawn.position.y}`,
                itemType: weaponSpawn.type,
                position: weaponSpawn.position,
                respawnTime: 15000,  // 15 seconds
                pickupRange: 32
            });

            // Add to gameState.weapons
            this.gameState.weapons.set(pickup.id, {
                id: pickup.id,
                type: weaponSpawn.type as any,
                spawnPosition: weaponSpawn.position,
                respawnTime: 15000,
                pickedUpBy: null,
                respawnAt: null
            });
        }

        // Listen to projectile hit events
        this.context.events.on('wyrt:projectileHit', (hitEvent: any) => {
            this.handleProjectileHit(hitEvent);
        });

    }

    private startGameLoop(): void {
        if (this.gameLoopInterval) {
            return;
        }

        const updateInterval = 1000 / GAME_UPDATE_RATE;
        this.gameLoopInterval = setInterval(() => this.update(), updateInterval);
    }

    start(): void {
        this.gameState.status = 'playing';
        this.gameState.startedAt = Date.now();

        this.context.events.emit('ctf:gameStatusChanged', {
            status: 'playing',
            startedAt: this.gameState.startedAt
        });
    }

    /**
     * Stop the game loop
     */
    stop(): void {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }

    /**
     * Main game update loop
     *
     * Called GAME_UPDATE_RATE times per second.
     */
    private update(): void {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;  // Convert to seconds
        this.lastUpdateTime = now;

        // Update projectiles with collision detection
        // Convert players to HittableEntity format for collision detection
        const hittableEntities = Array.from(this.gameState.players.values())
            .filter(p => !p.stunned && !p.respawning)  // Can't hit stunned/dead players
            .map(player => ({
                id: player.id,
                position: player.position,
                radius: 16,  // Player collision radius
                team: player.team  // For filtering same-team hits
            }));

        // Update projectiles (handles movement, collision, and cleanup)
        this.projectiles.update(deltaTime, hittableEntities);

        // Check projectiles against collision blocks and remove if they hit
        for (const [id, projectile] of this.gameState.projectiles.entries()) {
            const projPos = (projectile as any).position;
            const projRadius = (projectile as any).radius || 8;
            if (this.isPositionInCollisionBlock(projPos, projRadius)) {
                this.gameState.projectiles.delete(id);
                this.projectiles.removeProjectile(id);

                // Broadcast projectile hit wall event
                this.context.events.emit('ctf:projectileHitWall', {
                    projectileId: id,
                    position: projPos
                });
            }
        }

        // Sync projectile removals to gameState (hits/expirations handled by events)
        for (const [id, projectile] of this.gameState.projectiles.entries()) {
            if (now - (projectile as any).createdAt > 3000) {
                this.gameState.projectiles.delete(id);
            }
        }

        // Update respawning players
        for (const player of this.gameState.players.values()) {
            if (player.respawning && this.respawn.shouldRespawn(player.respawnAt)) {
                this.respawnPlayer(player.id);
            }
        }

        // Update weapons - handle respawning at random positions
        for (const [id, weapon] of this.gameState.weapons.entries()) {
            if (weapon.respawnAt && now >= weapon.respawnAt) {
                weapon.pickedUpBy = null;
                weapon.respawnAt = null;

                // Generate random spawn position (avoid bases)
                const worldWidth = this.mapConfig.width * this.mapConfig.tileSize;
                const worldHeight = this.mapConfig.height * this.mapConfig.tileSize;
                const margin = 100; // Stay away from edges and bases

                let newPosition: Position;
                let attempts = 0;
                do {
                    newPosition = {
                        x: margin + Math.random() * (worldWidth - margin * 2),
                        y: margin + Math.random() * (worldHeight - margin * 2)
                    };
                    attempts++;
                } while (
                    attempts < 20 &&
                    (this.isNearBase(newPosition, 'red', 100) ||
                     this.isNearBase(newPosition, 'blue', 100) ||
                     this.isPositionInCollisionBlock(newPosition))
                );

                // Update spawn position
                weapon.spawnPosition = newPosition;

                // Notify clients weapon has respawned at new position
                this.context.events.emit('ctf:weaponRespawned', {
                    weaponId: id,
                    position: newPosition
                });
            }
        }

        // Update buffs (expiration handled by core module)
        // Buff expirations are emitted via wyrt:buffExpired event

        // Update flags (auto-return)
        const flagUpdates = this.flagManager.update();
        for (const update of flagUpdates) {
            if (update.returned) {
                this.broadcastFlagReturned(update.team);
            }
        }

        // Check for disconnected players (30 seconds of inactivity)
        const DISCONNECT_TIMEOUT = 30000;  // 30 seconds
        const disconnectedPlayers: string[] = [];

        for (const [playerId, player] of this.gameState.players.entries()) {
            const timeSinceActivity = now - player.lastActivityTime;
            if (timeSinceActivity >= DISCONNECT_TIMEOUT) {
                disconnectedPlayers.push(playerId);
            }
        }

        // Remove disconnected players
        for (const playerId of disconnectedPlayers) {
            this.removePlayer(playerId);
            // Broadcast player disconnection
            this.context.events.emit('ctf:playerDisconnected', {
                playerId
            });
        }
    }

    /**
     * Add a player to the game
     */
    addPlayer(playerId: string, playerName: string): CTFPlayer {
        // Assign team using core module
        const teamId = this.teams.assignPlayer(playerId, { mode: 'auto-balance' });

        // Get spawn position
        const spawnPoints = this.mapConfig.bases[teamId].spawnPoints;
        const spawnIndex = this.gameState.players.size % spawnPoints.length;
        const spawnPosition = spawnPoints[spawnIndex];

        // Create player
        const player: CTFPlayer = {
            id: playerId,
            name: playerName,
            team: teamId as Team,
            position: { ...spawnPosition },
            direction: 'down',
            carryingFlag: false,
            stunned: false,
            stunnedUntil: null,
            respawning: false,
            respawnAt: null,
            weapon: null,
            weaponCharges: 0,
            activeBoost: null,
            boostEndsAt: null,
            hasSpeed: false,
            hasShield: false,
            lastActivityTime: Date.now()
        };

        this.gameState.players.set(playerId, player);


        this.startGameLoop();

        if (this.gameState.status === 'waiting' && this.gameState.players.size >= 2) {
            this.start();
        }

        return player;
    }

    /**
     * Remove a player from the game
     */
    removePlayer(playerId: string): void {
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        // Drop flag if carrying
        if (player.carryingFlag) {
            const droppedTeam = this.flagManager.dropFlag(playerId, player.position);
            if (droppedTeam) {
                this.broadcastFlagDropped(droppedTeam, player.position, playerId);
            }
        }

        this.gameState.players.delete(playerId);


        // Stop game if not enough players
        if (this.gameState.players.size < 2 && this.gameState.status === 'playing') {
            this.stop();
            this.gameState.status = 'waiting';
        }
    }

    /**
     * Update player position
     */
    updatePlayerPosition(playerId: string, position: Position, direction: Direction): void {
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        // Can't move while stunned or dead
        if (player.stunned || player.respawning) return;

        // Check if new position collides with walls (reject movement if it does)
        const PLAYER_RADIUS = 16;
        if (this.isPositionInCollisionBlock(position, PLAYER_RADIUS)) {
            return;  // Don't update position if it collides with a wall
        }

        player.position = position;
        player.direction = direction;
        player.lastActivityTime = Date.now();  // Update activity for disconnect detection

        // Check if player is at their base with enemy flag (capture attempt)
        if (player.carryingFlag) {
            const basePosition = this.mapConfig.bases[player.team].position;
            const result = this.flagManager.attemptCapture(player, basePosition, CAPTURE_LIMIT);

            if (result.scored) {
                // Broadcast the capture
                this.broadcastFlagCaptured(player.team, playerId);

                // Broadcast that the enemy flag returned to base (so clients can update immediately)
                const enemyTeam: Team = player.team === 'red' ? 'blue' : 'red';
                this.broadcastFlagReturned(enemyTeam);

                if (result.won) {
                    this.endMatch(player.team);
                }
            }
        }

        // Check if player is near their own dropped flag (return it)
        const ownFlag = this.gameState.flags[player.team];
        if (ownFlag.state === 'dropped') {
            const distance = Math.sqrt(
                Math.pow(position.x - ownFlag.position.x, 2) +
                Math.pow(position.y - ownFlag.position.y, 2)
            );

            if (distance < 32) {
                // Return flag to base
                this.flagManager.returnFlag(player.team);
                this.broadcastFlagReturned(player.team);
            }
        }
    }

    /**
     * Player attempts to pick up flag
     */
    pickupFlag(playerId: string, flagTeam: Team): boolean {
        const player = this.gameState.players.get(playerId);
        if (!player) {
            return false;
        }

        // Check if this is a return (own team's dropped flag) or a pickup (enemy flag)
        const isReturn = player.team === flagTeam;
        const result = this.flagManager.attemptPickup(player, flagTeam);

        if (result.success) {
            if (isReturn) {
                // Teammate returned the flag to base
                this.broadcastFlagReturned(flagTeam);
            } else {
                // Enemy picked up the flag
                this.broadcastFlagPickedUp(flagTeam, playerId, player.position);
            }
        }

        return result.success;
    }

    /**
     * Player attempts to pick up weapon
     */
    pickupWeapon(playerId: string, weaponId: string): boolean {
        const player = this.gameState.players.get(playerId);
        if (!player) return false;

        // Check pickup using core module
        const pickupEvent = this.pickups.attemptPickup(weaponId, playerId);

        if (pickupEvent) {
            const weaponType = pickupEvent.itemType;

            // Update gameState.weapons
            const weapon = this.gameState.weapons.get(weaponId);
            if (weapon) {
                weapon.pickedUpBy = playerId;
                weapon.respawnAt = Date.now() + weapon.respawnTime;
            }

            // Boosts auto-activate, stun gun is stored
            if (weaponType === 'stun_gun') {
                player.weapon = 'stun_gun';
                player.weaponCharges = 3;
                this.broadcastWeaponPickedUp(weaponId, playerId, weaponType);
            } else {
                // Auto-activate boost
                const boostType = weaponType;
                const duration = boostType === 'speed_boost' ? 10000 : 5000;

                // Apply buff using core module (stackable so multiple boosts work)
                this.buffs.applyBuff(playerId, {
                    type: boostType,
                    category: 'buff',
                    duration: duration,
                    stackable: true,  // Allow multiple boosts
                    modifiers: boostType === 'speed_boost'
                        ? { moveSpeed: 1.5 }
                        : { shield: true },
                    onApply: (targetId, buff) => {
                        const p = this.gameState.players.get(targetId);
                        if (p) {
                            // Set activeBoost to prioritize shield, then speed
                            if (boostType === 'shield') {
                                p.activeBoost = 'shield';
                            } else if (!p.activeBoost || p.activeBoost !== 'shield') {
                                p.activeBoost = 'speed';
                            }
                            p.boostEndsAt = Date.now() + duration;
                        }
                        this.broadcastBoostActivated(targetId, boostType, duration);
                    },
                    onExpire: (targetId, buff) => {
                        const p = this.gameState.players.get(targetId);
                        if (p) {
                            // Check if player still has other active buffs
                            const hasShield = this.buffs.hasBuff(targetId, 'shield');
                            const hasSpeed = this.buffs.hasBuff(targetId, 'speed_boost');

                            if (hasShield) {
                                p.activeBoost = 'shield';
                            } else if (hasSpeed) {
                                p.activeBoost = 'speed';
                            } else {
                                p.activeBoost = null;
                                p.boostEndsAt = null;
                            }
                        }
                        this.broadcastBoostExpired(targetId, boostType);
                    }
                });

                this.broadcastWeaponPickedUp(weaponId, playerId, weaponType);
            }

            return true;
        }

        return false;
    }

    /**
     * Player shoots (fires projectile)
     */
    shoot(playerId: string, direction: { x: number; y: number }): boolean {
        const player = this.gameState.players.get(playerId);
        if (!player) return false;

        // Check if player has scatter gun with ammo
        const hasScatterGun = player.weapon === 'stun_gun' && player.weaponCharges > 0;

        if (hasScatterGun) {
            // Use weapon charge
            player.weaponCharges--;
            if (player.weaponCharges <= 0) {
                player.weapon = null;
                // Broadcast weapon removed
                this.context.events.emit('ctf:weaponRemoved', {
                    playerId
                });
            }

            // Scatter gun - fire 5 projectiles in a spread pattern
            const spreadAngles = [-0.3, -0.15, 0, 0.15, 0.3]; // ~17 degree spread each
            const baseAngle = Math.atan2(direction.y, direction.x);

            for (const angleOffset of spreadAngles) {
                const angle = baseAngle + angleOffset;
                const spreadDirection = {
                    x: Math.cos(angle),
                    y: Math.sin(angle)
                };

                // Fire projectile using core module
                const projectile = this.projectiles.fireProjectile({
                    ownerId: playerId,
                    position: { ...player.position },
                    velocity: ProjectileManager.createVelocity(spreadDirection, 300),
                    radius: 8,
                    ttl: 3000,
                    hitFilter: (target) => {
                        // Can't hit yourself
                        if (target.id === playerId) return false;
                        // Can't hit teammates
                        return !this.teams.isFriendly(playerId, target.id);
                    },
                    onHit: (proj, target) => {
                        this.handleProjectileHit(proj.id, target.id, playerId);
                    }
                });

                // Add to gameState.projectiles
                this.gameState.projectiles.set(projectile.id, projectile as any);

                // Broadcast (ctf-specific event, not wyrt:projectileFired)
                this.broadcastProjectileFired(projectile.id, playerId, projectile.position, projectile.velocity);
            }
        } else {
            // Regular single shot (infinite ammo)
            const projectile = this.projectiles.fireProjectile({
                ownerId: playerId,
                position: { ...player.position },
                velocity: ProjectileManager.createVelocity(direction, 300),
                radius: 8,
                ttl: 3000,
                hitFilter: (target) => {
                    // Can't hit yourself
                    if (target.id === playerId) return false;
                    // Can't hit teammates
                    return !this.teams.isFriendly(playerId, target.id);
                },
                onHit: (proj, target) => {
                    this.handleProjectileHit(proj.id, target.id, playerId);
                }
            });

            // Add to gameState.projectiles
            this.gameState.projectiles.set(projectile.id, projectile as any);

            // Broadcast (ctf-specific event, not wyrt:projectileFired)
            this.broadcastProjectileFired(projectile.id, playerId, projectile.position, projectile.velocity);
        }

        return true;
    }

    /**
     * Player activates boost (speed or shield)
     */
    activateBoost(playerId: string): boolean {
        const player = this.gameState.players.get(playerId);
        if (!player) return false;

        // Must have boost item
        if (!player.weapon || (player.weapon !== 'speed_boost' && player.weapon !== 'shield')) {
            return false;
        }

        if (player.weaponCharges <= 0) {
            return false;
        }

        const boostType = player.weapon;
        const duration = boostType === 'speed_boost' ? 10000 : 5000;

        // Use charge
        player.weaponCharges--;
        if (player.weaponCharges <= 0) {
            player.weapon = null;
        }

        // Apply buff using core module
        this.buffs.applyBuff(playerId, {
            type: boostType,
            category: 'buff',
            duration: duration,
            stackable: false,
            modifiers: boostType === 'speed_boost'
                ? { moveSpeed: 1.5 }
                : { shield: true },
            onApply: (targetId, buff) => {
                const p = this.gameState.players.get(targetId);
                if (p) {
                    p.activeBoost = boostType as any;
                    p.boostEndsAt = Date.now() + duration;
                }
            },
            onExpire: (targetId, buff) => {
                const p = this.gameState.players.get(targetId);
                if (p) {
                    p.activeBoost = null;
                    p.boostEndsAt = null;
                }
                this.broadcastBoostExpired(targetId, boostType);
            }
        });

        this.broadcastBoostActivated(playerId, boostType, duration);

        return true;
    }

    /**
     * Handle projectile hit (from both event and callback)
     */
    private handleProjectileHit(projectileIdOrEvent: string | any, targetId?: string, shooterId?: string): void {
        // Support both event signature and direct callback signature
        let actualTargetId: string;
        let actualProjectileId: string;

        if (typeof projectileIdOrEvent === 'object') {
            // Called from event listener
            actualTargetId = projectileIdOrEvent.targetId;
            actualProjectileId = projectileIdOrEvent.projectileId;
        } else {
            // Called from onHit callback
            actualTargetId = targetId!;
            actualProjectileId = projectileIdOrEvent;
        }

        const target = this.gameState.players.get(actualTargetId);
        if (!target || target.respawning) return;

        // Remove projectile from gameState
        this.gameState.projectiles.delete(actualProjectileId);

        // Check if target has shield
        if (this.buffs.hasBuff(actualTargetId, 'shield')) {
            // Shield blocks the hit
            return;
        }

        // Drop flag IMMEDIATELY if carrying
        if (target.carryingFlag) {
            const droppedTeam = this.flagManager.dropFlag(actualTargetId, target.position);
            if (droppedTeam) {
                // Get the actual flag position (which has random offset applied)
                const actualFlagPosition = this.gameState.flags[droppedTeam].position;
                this.broadcastFlagDropped(droppedTeam, actualFlagPosition, actualTargetId);
            } else {
            }
        } else {
        }

        // Clear all buffs/boosts on death
        this.buffs.removeBuff(actualTargetId, 'speed_boost');
        this.buffs.removeBuff(actualTargetId, 'shield');

        // Mark player as dead using respawn module
        const respawnAt = this.respawn.markDead(actualTargetId);

        // Kill player - set respawning state
        target.respawning = true;
        target.respawnAt = respawnAt;
        target.stunned = false;
        target.stunnedUntil = null;
        target.carryingFlag = false;
        target.activeBoost = null;
        target.boostEndsAt = null;
        target.hasSpeed = false;
        target.hasShield = false;

        // Broadcast player killed
        this.context.events.emit('ctf:playerKilled', {
            playerId: actualTargetId,
            respawnAt: target.respawnAt
        });

    }

    /**
     * Respawn a player at their base
     */
    private respawnPlayer(playerId: string): void {
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        // Get spawn position from respawn module
        const spawnPosition = this.respawn.respawn(playerId, player.team);
        if (!spawnPosition) {
            console.error(`[CTFGameManager] Failed to respawn player ${playerId} - no spawn points`);
            return;
        }

        // Reset player state
        player.position = { ...spawnPosition };
        player.respawning = false;
        player.respawnAt = null;
        player.direction = 'down';

        // Broadcast player respawned
        this.context.events.emit('ctf:playerRespawned', {
            playerId,
            position: spawnPosition
        });

    }

    /**
     * End the match
     */
    private endMatch(winningTeam: Team): void {
        this.gameState.status = 'ended';
        this.gameState.winnerId = winningTeam;
        this.gameState.endedAt = Date.now();

        this.stop();


        this.broadcastMatchEnded(winningTeam);

        // Restart game after 5 seconds
        setTimeout(() => {
            this.resetGame();
            this.broadcastGameReset();
        }, 5000);
    }

    /**
     * Reset the game after a match ends
     */
    private resetGame(): void {
        // Reset scores
        this.flagManager.resetScores();

        // Reset flags to base (use exact base positions from map config)
        this.flagManager.resetFlags(
            this.mapConfig.bases.red.position,
            this.mapConfig.bases.blue.position
        );

        // Reset all players to spawn positions
        for (const [playerId, player] of this.gameState.players.entries()) {
            const spawnPoints = this.mapConfig.bases[player.team].spawnPoints;
            const spawnIndex = Array.from(this.gameState.players.values())
                .filter(p => p.team === player.team)
                .indexOf(player);
            const spawnPosition = spawnPoints[spawnIndex % spawnPoints.length];

            player.position = { ...spawnPosition };
            player.direction = 'down';
            player.carryingFlag = false;
            player.stunned = false;
            player.stunnedUntil = null;
            player.respawning = false;
            player.respawnAt = null;
            player.weapon = null;
            player.weaponCharges = 0;
            player.activeBoost = null;
            player.boostEndsAt = null;
            player.hasSpeed = false;
            player.hasShield = false;
            player.lastActivityTime = Date.now(); // Reset activity time to prevent immediate disconnect
        }

        // Reset powerups/weapons
        this.gameState.weapons.clear();
        for (const weaponSpawn of this.mapConfig.weaponSpawns) {
            const weaponId = `weapon_${weaponSpawn.position.x}_${weaponSpawn.position.y}`;
            this.gameState.weapons.set(weaponId, {
                id: weaponId,
                type: weaponSpawn.type as any,
                spawnPosition: weaponSpawn.position,
                respawnTime: 15000,
                pickedUpBy: null,
                respawnAt: null
            });
        }

        // Reset buffs
        this.buffs.clearAll();

        // Reset pickups
        this.pickups.resetAll();

        // Reset game state
        this.gameState.status = 'playing';
        this.gameState.winnerId = null;
        this.gameState.startedAt = Date.now();
        this.gameState.endedAt = null;

        // Restart game loop
        this.start();

    }

    /**
     * Broadcast game reset to all players
     */
    private broadcastGameReset(): void {
        const gameState = this.getGameState();
        this.context.events.emit('ctf:gameReset', {
            gameState: {
                matchId: gameState.matchId,
                status: gameState.status,
                scores: gameState.scores,
                captureLimit: gameState.captureLimit,
                flags: gameState.flags,
                players: Array.from(gameState.players.values()),
                weapons: Array.from(gameState.weapons.values()),
                projectiles: Array.from(gameState.projectiles.values()),
                winnerId: gameState.winnerId,
                startedAt: gameState.startedAt,
                endedAt: gameState.endedAt
            },
            mapConfig: this.mapConfig
        });
    }

    /**
     * Get game state (for sending to client)
     */
    getGameState(): CTFGameState {
        return this.gameState;
    }

    /**
     * Get map config
     */
    getMapConfig(): MapConfig {
        return this.mapConfig;
    }

    /**
     * Check if position is near a base
     */
    private isNearBase(position: Position, team: Team, distance: number): boolean {
        const base = this.mapConfig.bases[team].position;
        const dx = position.x - base.x;
        const dy = position.y - base.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
    }

    /**
     * Check if position overlaps with any collision block (with optional radius for projectiles)
     */
    private isPositionInCollisionBlock(position: Position, radius: number = 0): boolean {
        if (!this.mapConfig.collisionLayer) return false;

        for (const block of this.mapConfig.collisionLayer) {
            // Check if circle overlaps with rectangle
            // Find closest point on rectangle to circle center
            const closestX = Math.max(block.x, Math.min(position.x, block.x + block.width));
            const closestY = Math.max(block.y, Math.min(position.y, block.y + block.height));

            // Calculate distance from circle center to closest point
            const distanceX = position.x - closestX;
            const distanceY = position.y - closestY;
            const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

            // Check if distance is less than radius
            if (distanceSquared <= (radius * radius)) {
                return true;
            }
        }

        return false;
    }

    // ===== BROADCAST METHODS =====

    private broadcastFlagPickedUp(flagTeam: Team, playerId: string, position: Position): void {
        this.context.events.emit('ctf:flagPickedUp', {
            flagTeam,
            playerId,
            position
        });
    }

    private broadcastFlagDropped(flagTeam: Team, position: Position, playerId: string): void {
        this.context.events.emit('ctf:flagDropped', {
            flagTeam,
            position,
            droppedAt: Date.now(),
            playerId
        });
    }

    private broadcastFlagReturned(flagTeam: Team): void {
        this.context.events.emit('ctf:flagReturned', {
            flagTeam
        });
    }

    private broadcastFlagCaptured(team: Team, playerId: string): void {
        this.context.events.emit('ctf:flagCaptured', {
            team,
            playerId,
            newScore: this.gameState.scores
        });
    }

    private broadcastWeaponPickedUp(weaponId: string, playerId: string, weaponType: string): void {
        this.context.events.emit('ctf:weaponPickedUp', {
            weaponId,
            playerId,
            weaponType
        });
    }

    private broadcastWeaponSpawned(weapon: any): void {
        this.context.events.emit('ctf:weaponSpawned', {
            weapon
        });
    }

    private broadcastProjectileFired(projectileId: string, playerId: string, position: Position, velocity: any): void {
        this.context.events.emit('ctf:projectileFired', {
            projectileId,
            playerId,
            position,
            velocity
        });
    }

    private broadcastPlayerStunned(playerId: string, stunnedBy: string, droppedFlag: boolean): void {
        this.context.events.emit('ctf:playerStunned', {
            playerId,
            stunnedBy,
            duration: 3000,
            droppedFlag
        });
    }

    private broadcastPlayerRecovered(playerId: string): void {
        this.context.events.emit('ctf:playerRecovered', {
            playerId
        });
    }

    private broadcastBoostActivated(playerId: string, boostType: string, duration: number): void {
        // Include info about all active buffs
        const hasSpeed = this.buffs.hasBuff(playerId, 'speed_boost');
        const hasShield = this.buffs.hasBuff(playerId, 'shield');

        this.context.events.emit('ctf:boostActivated', {
            playerId,
            boostType,
            duration,
            hasSpeed,
            hasShield
        });
    }

    private broadcastBoostExpired(playerId: string, boostType: string): void {
        // Include current buff states after expiration
        const hasSpeed = this.buffs.hasBuff(playerId, 'speed_boost');
        const hasShield = this.buffs.hasBuff(playerId, 'shield');

        this.context.events.emit('ctf:boostExpired', {
            playerId,
            boostType,
            hasSpeed,
            hasShield
        });
    }

    private broadcastMatchEnded(winner: Team): void {
        this.context.events.emit('ctf:matchEnded', {
            winner,
            finalScore: this.gameState.scores
        });
    }
}
