import { EventEmitter } from 'events';
import { ResourceNodeConfig, ResourceNodeState, DamageResult, GatherResult } from '../types/Resource';

/**
 * Generic resource node manager
 * Handles node HP, depletion, respawning, and loot rolling
 */
export class ResourceManager extends EventEmitter {
    private nodeStates: Map<string, ResourceNodeState> = new Map();
    private nodeConfigs: Map<string, ResourceNodeConfig> = new Map();
    private respawnTimers: Map<string, NodeJS.Timeout> = new Map();
    private gameId: string;

    constructor(gameId: string) {
        super();
        this.gameId = gameId;
    }

    /**
     * Register a node configuration
     */
    registerNodeType(type: string, config: ResourceNodeConfig): void {
        this.nodeConfigs.set(type, config);
    }

    /**
     * Spawn a resource node instance
     */
    spawnNode(id: string, type: string, position: { x: number; y: number }): ResourceNodeState | null {
        const config = this.nodeConfigs.get(type);
        if (!config) {
            console.error(`[wyrt_resources:${this.gameId}] Unknown node type: ${type}`);
            return null;
        }

        const nodeState: ResourceNodeState = {
            id,
            type,
            hp: config.maxHp,
            maxHp: config.maxHp,
            position
        };

        this.nodeStates.set(id, nodeState);

        // Emit spawn event for game to handle
        this.emit('node:spawned', {
            gameId: this.gameId,
            nodeId: id,
            type,
            position
        });

        return nodeState;
    }

    /**
     * Damage a node (generic - no specific damage values)
     */
    damageNode(nodeId: string, damage: number): DamageResult | null {
        const node = this.nodeStates.get(nodeId);
        if (!node) return null;

        // Check if already depleted
        if (node.respawnTime !== undefined) {
            return null; // Node is depleted and respawning
        }

        const config = this.nodeConfigs.get(node.type);
        if (!config) return null;

        // Apply damage
        node.hp -= damage;
        const depleted = node.hp <= 0;
        let lootItem: string | null = null;

        if (depleted) {
            node.hp = 0;
            lootItem = this.rollLootTable(config.items);

            // Schedule respawn
            this.scheduleRespawn(nodeId, config.respawnTime);

            // Emit depletion event for game to handle
            this.emit('node:depleted', {
                gameId: this.gameId,
                nodeId,
                type: node.type,
                position: node.position,
                lootItem
            });
        }

        return {
            damage,
            remaining: node.hp,
            depleted,
            item: lootItem
        };
    }

    /**
     * Roll loot table using weighted random selection
     */
    private rollLootTable(items: Array<[number, string]>): string | null {
        if (!items || items.length === 0) return null;

        const totalWeight = items.reduce((sum, [weight]) => sum + weight, 0);
        const roll = Math.random() * totalWeight;

        let currentWeight = 0;
        for (const [weight, itemId] of items) {
            currentWeight += weight;
            if (roll < currentWeight) {
                return itemId;
            }
        }

        return items[items.length - 1][1]; // Fallback to last item
    }

    /**
     * Schedule node respawn
     */
    private scheduleRespawn(nodeId: string, delayMs: number): void {
        const node = this.nodeStates.get(nodeId);
        if (!node) return;

        // Clear any existing timer
        this.clearRespawnTimer(nodeId);

        // Mark respawn time
        node.respawnTime = Date.now() + delayMs;

        // Schedule respawn
        const timer = setTimeout(() => {
            this.respawnNode(nodeId);
        }, delayMs);

        this.respawnTimers.set(nodeId, timer);
    }

    /**
     * Respawn a depleted node
     */
    private respawnNode(nodeId: string): void {
        const node = this.nodeStates.get(nodeId);
        if (!node) return;

        const config = this.nodeConfigs.get(node.type);
        if (!config) return;

        // Reset node state
        node.hp = config.maxHp;
        delete node.respawnTime;

        // Clear timer
        this.clearRespawnTimer(nodeId);

        // Emit respawn event for game to handle
        this.emit('node:respawned', {
            gameId: this.gameId,
            nodeId,
            type: node.type,
            position: node.position
        });
    }

    /**
     * Clear respawn timer
     */
    private clearRespawnTimer(nodeId: string): void {
        const timer = this.respawnTimers.get(nodeId);
        if (timer) {
            clearTimeout(timer);
            this.respawnTimers.delete(nodeId);
        }
    }

    /**
     * Check if node is depleted
     */
    isNodeDepleted(nodeId: string): boolean {
        const node = this.nodeStates.get(nodeId);
        return node ? node.respawnTime !== undefined : false;
    }

    /**
     * Get node state
     */
    getNodeState(nodeId: string): ResourceNodeState | undefined {
        return this.nodeStates.get(nodeId);
    }

    /**
     * Remove a node (cleanup)
     */
    removeNode(nodeId: string): void {
        this.clearRespawnTimer(nodeId);
        this.nodeStates.delete(nodeId);

        this.emit('node:removed', {
            gameId: this.gameId,
            nodeId
        });
    }

    /**
     * Cleanup all nodes and timers
     */
    cleanup(): void {
        // Clear all respawn timers
        for (const timer of this.respawnTimers.values()) {
            clearTimeout(timer);
        }
        this.respawnTimers.clear();
        this.nodeStates.clear();
    }
}
