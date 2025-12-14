/**
 * wyrt_party - Game-agnostic Party System Module
 *
 * Provides party/group functionality for multiplayer games:
 * - Party creation and dissolution
 * - Invite/accept/decline/kick mechanics
 * - Leader management and promotion
 * - Event-driven architecture for game integration
 *
 * Games integrate by:
 * 1. Getting the PartyManager instance via context.getModule('wyrt_party').partyManager
 * 2. Subscribing to party events for broadcasting
 * 3. Calling updateMemberGameData() when player stats change
 * 4. Implementing their own UI and stat display logic
 *
 * @example
 * // In your game module:
 * const partyModule = context.getModule('wyrt_party');
 * const partyManager = partyModule.partyManager;
 *
 * // Subscribe to events
 * partyManager.on('member_joined', (event) => {
 *   // Broadcast party state to all members
 * });
 *
 * // Update member stats (HP/mana changes)
 * partyManager.updateMemberGameData(playerId, { hp: 80, maxHp: 100, mp: 50, maxMp: 100 });
 */

import { IModule } from '../../../src/module/IModule';
import { ModuleContext } from '../../../src/module/ModuleContext';
import { PartyManager } from './systems/PartyManager';
import { PartyConfig, PartyEvent } from './types/Party';

export class WyrtPartyModule implements IModule {
    name = 'wyrt_party';
    version = '1.0.0';
    description = 'Game-agnostic party/group system for multiplayer games';
    dependencies = ['wyrt_core'];

    private context!: ModuleContext;
    public partyManager!: PartyManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get configuration from module config or use defaults
        const config: PartyConfig = {
            maxPartySize: context.config?.maxPartySize ?? 5,
            inviteTimeout: context.config?.inviteTimeout ?? 60000,
            enablePartyChat: context.config?.enablePartyChat ?? true
        };

        this.partyManager = new PartyManager(config);

        // Set up event logging
        this.partyManager.on('party_event', (event: PartyEvent) => {
            context.logger.debug(`[Party] ${event.type}: party=${event.partyId}, player=${event.playerId}`);
        });

        context.logger.info(`[${this.name}] Initialized with maxPartySize=${config.maxPartySize}`);
    }

    async activate(): Promise<void> {
        this.context.logger.info(`[${this.name}] Activated`);
    }

    async deactivate(): Promise<void> {
        this.partyManager.destroy();
        this.context.logger.info(`[${this.name}] Deactivated`);
    }

    /**
     * Handle player disconnect - clean up party membership
     */
    handleDisconnect(playerId: string): void {
        this.partyManager.handleDisconnect(playerId);
    }

    /**
     * Get the PartyManager instance
     */
    getPartyManager(): PartyManager {
        return this.partyManager;
    }
}

// Export types for external use
export * from './types/Party';
export { PartyManager } from './systems/PartyManager';

// Default export for module loading
export default WyrtPartyModule;
