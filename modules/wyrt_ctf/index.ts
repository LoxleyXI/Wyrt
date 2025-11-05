/**
 * WYRT CTF - CAPTURE THE FLAG GAME
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { CTFGameManager } from './systems/CTFGameManager';
import { MapConfig } from './types/CTFTypes';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class WyrtCTFModule implements IModule {
    name = 'wyrt_ctf';
    version = '1.0.0';
    description = 'Capture the Flag demo game';
    dependencies = ['wyrt_core', 'wyrt_2d', 'wyrt_collision', 'wyrt_teams', 'wyrt_pickups', 'wyrt_projectiles', 'wyrt_buffs', 'wyrt_respawn'];

    private context?: ModuleContext;
    private gameManager?: CTFGameManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        context.logger.info(`[wyrt_ctf] Initialized`);
    }

    async activate(): Promise<void> {
        if (!this.context) {
            throw new Error('Context not initialized');
        }

        context.logger.info(`[wyrt_ctf] Initializing CTF game...`);

        // Load map configuration
        const mapPath = path.join(__dirname, 'data/maps/ctf_arena.json');
        const mapData = fs.readFileSync(mapPath, 'utf-8');
        const mapConfig: MapConfig = JSON.parse(mapData);

        // Create game manager (now that dependencies are loaded)
        this.gameManager = new CTFGameManager(this.context, mapConfig);
        (globalThis as any).ctfGameManager = this.gameManager;

        // Set up event handlers
        this.setupEventHandlers(this.context);

        context.logger.info(`[wyrt_ctf] CTF game activated`);
    }

    async deactivate(): Promise<void> {
        if (this.gameManager) {
            (this.gameManager as any).stop();
        }
        delete (globalThis as any).ctfGameManager;
        context.logger.info(`wyrt_ctf module deactivated`);
    }

    private setupEventHandlers(context: ModuleContext): void {
        const events = context.events;
        events.on('ctf:playerJoined', (data) => this.broadcastToAll('playerJoined', data));
        events.on('ctf:playerMoved', (data) => this.broadcastToAll('playerMoved', data));
        events.on('ctf:flagPickedUp', (data) => this.broadcastToAll('flagPickedUp', data));
        events.on('ctf:flagDropped', (data) => this.broadcastToAll('flagDropped', data));
        events.on('ctf:flagCaptured', (data) => this.broadcastToAll('flagCaptured', data));
        events.on('ctf:flagReturned', (data) => this.broadcastToAll('flagReturned', data));
        events.on('ctf:weaponPickedUp', (data) => this.broadcastToAll('weaponPickedUp', data));
        events.on('ctf:weaponRemoved', (data) => this.broadcastToAll('weaponRemoved', data));
        events.on('ctf:weaponRespawned', (data) => this.broadcastToAll('weaponRespawned', data));
        events.on('ctf:projectileFired', (data) => this.broadcastToAll('projectileFired', data));
        events.on('ctf:projectileHitWall', (data) => this.broadcastToAll('projectileHitWall', data));
        events.on('ctf:playerStunned', (data) => this.broadcastToAll('playerStunned', data));
        events.on('ctf:playerKilled', (data) => this.broadcastToAll('playerKilled', data));
        events.on('ctf:playerRespawned', (data) => this.broadcastToAll('playerRespawned', data));
        events.on('ctf:boostActivated', (data) => this.broadcastToAll('boostActivated', data));
        events.on('ctf:boostExpired', (data) => this.broadcastToAll('boostExpired', data));
        events.on('ctf:matchEnded', (data) => this.broadcastToAll('matchEnded', data));
        events.on('ctf:playerDisconnected', (data) => this.broadcastToAll('playerDisconnected', data));
        events.on('ctf:gameStatusChanged', (data) => this.broadcastToAll('gameStatusChanged', data));
        events.on('ctf:gameReset', (data) => this.broadcastToAll('gameReset', data));
    }

    private broadcastToAll(type: string, eventData: any): void {
        if (!this.context) return;

        const message = JSON.stringify({
            type,
            ...eventData
        });

        // Broadcast to all connected WebSocket clients
        const users = this.context.data.users;
        for (const userId in users) {
            const user = users[userId];
            if (user && user.send) {
                user.send(message);
            }
        }

    }
}
