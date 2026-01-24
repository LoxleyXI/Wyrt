/**
 * @module wyrt_currency
 * @description Currency management system with multiple currency types per character
 * @category Economy
 *
 * Uses the Character.currency JSON field from wyrt_data for persistence.
 * Supports any game-defined currency types (gold, gems, tokens, reputation, etc.)
 *
 * @features
 * - Multiple currency types per game
 * - Database persistence via wyrt_data
 * - Add/remove/set/transfer operations
 * - Balance caps (min/max)
 * - Transfer between characters
 * - Event emission for currency changes
 *
 * @usage
 * ```typescript
 * const currencyModule = context.getModule('wyrt_currency');
 * const currency = currencyModule.createCurrencySystem('my_game', {
 *   currencies: {
 *     gold: { name: 'Gold', icon: 'coin', maxBalance: 999999 },
 *     gems: { name: 'Gems', icon: 'gem', maxBalance: 9999 },
 *   },
 *   defaults: { gold: 100 }
 * });
 *
 * // Add gold to a character
 * await currency.add(characterId, 'gold', 50);
 *
 * // Check balance
 * const gold = await currency.getBalance(characterId, 'gold');
 *
 * // Transfer between players
 * await currency.transfer(fromId, toId, 'gold', 100);
 * ```
 *
 * @events
 * - `currency:added` - { characterId, currencyType, amount, previousBalance, newBalance }
 * - `currency:removed` - { characterId, currencyType, amount, previousBalance, newBalance }
 * - `currency:set` - { characterId, currencyType, previousBalance, newBalance }
 * - `currency:transferred` - { fromCharacterId, toCharacterId, currencyType, amount }
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { CurrencySystem, CurrencyConfig, CurrencyAPI, CurrencyBalance, CurrencyTransaction } from './systems/CurrencySystem';
import type DataModule from '../wyrt_data/index.js';
import colors from 'colors/safe';

// Re-export types
export { CurrencySystem, CurrencyConfig, CurrencyAPI, CurrencyBalance, CurrencyTransaction };

export default class CurrencyModule implements IModule {
  name = 'wyrt_currency';
  version = '1.0.0';
  description = 'Multi-currency management system using wyrt_data';
  dependencies = ['wyrt_data'];

  private context?: ModuleContext;
  private dataModule?: DataModule;
  private currencySystems: Map<string, CurrencySystem> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;

    // Get wyrt_data module for database access
    this.dataModule = context.getModule?.('wyrt_data') as DataModule;
    if (!this.dataModule) {
      throw new Error('[wyrt_currency] wyrt_data module is required');
    }

    console.log(`[${this.name}] Initialized with wyrt_data backend`);
  }

  async activate(context: ModuleContext): Promise<void> {
    context.logger.debug(colors.green('+module ') + 'wyrt_currency');
    context.events.emit('currencyModuleActivated');
  }

  async deactivate(context: ModuleContext): Promise<void> {
    this.currencySystems.clear();
    console.log(`[${this.name}] Module deactivated`);
  }

  /**
   * Create a currency system for a specific game.
   *
   * @param gameId - The game identifier
   * @param config - Currency configuration (currency types, defaults, caps)
   * @returns The currency system instance
   */
  createCurrencySystem(gameId: string, config?: CurrencyConfig): CurrencySystem {
    if (this.currencySystems.has(gameId)) {
      return this.currencySystems.get(gameId)!;
    }

    if (!this.context || !this.dataModule) {
      throw new Error('Module not initialized');
    }

    const system = new CurrencySystem(this.context, this.dataModule, config);
    this.currencySystems.set(gameId, system);
    console.log(`[${this.name}] Created currency system for game: ${gameId}`);
    return system;
  }

  /**
   * Get an existing currency system for a game.
   *
   * @param gameId - The game identifier
   * @returns The currency system instance
   * @throws Error if the system hasn't been created
   */
  getCurrencySystem(gameId: string): CurrencySystem {
    const system = this.currencySystems.get(gameId);
    if (!system) {
      throw new Error(`CurrencySystem for game '${gameId}' not found. Did you call createCurrencySystem()?`);
    }
    return system;
  }
}
