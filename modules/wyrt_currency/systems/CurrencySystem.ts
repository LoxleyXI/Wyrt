/**
 * Currency System
 *
 * Manages multiple currency types per character using the Character.currency JSON field.
 * Supports any game-defined currency (gold, gems, tokens, reputation points, etc.)
 */

import type { ModuleContext } from '../../../src/module/ModuleContext.js';
import type DataModule from '../../wyrt_data/index.js';

/**
 * Result of a currency transaction.
 */
export interface CurrencyTransaction {
  success: boolean;
  message?: string;
  newBalance?: number;
  previousBalance?: number;
}

/**
 * Currency balance for a character.
 */
export interface CurrencyBalance {
  [currencyType: string]: number;
}

/**
 * Configuration for the currency system.
 */
export interface CurrencyConfig {
  /** Currency types available in this game */
  currencies?: {
    [slug: string]: {
      name: string;
      icon?: string;
      maxBalance?: number;
      minBalance?: number;  // Usually 0, but could be negative for debt systems
    };
  };
  /** Default starting balances for new characters */
  defaults?: CurrencyBalance;
}

/**
 * API for currency operations.
 */
export interface CurrencyAPI {
  getBalance(characterId: string, currencyType: string): Promise<number>;
  getAllBalances(characterId: string): Promise<CurrencyBalance>;
  add(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction>;
  remove(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction>;
  set(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction>;
  has(characterId: string, currencyType: string, amount: number): Promise<boolean>;
  transfer(fromCharacterId: string, toCharacterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction>;
}

export class CurrencySystem implements CurrencyAPI {
  private context: ModuleContext;
  private dataModule: DataModule;
  private config: CurrencyConfig;

  constructor(context: ModuleContext, dataModule: DataModule, config: CurrencyConfig = {}) {
    this.context = context;
    this.dataModule = dataModule;
    this.config = config;
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  /**
   * Get the currency definition for validation.
   */
  private getCurrencyDef(currencyType: string) {
    return this.config.currencies?.[currencyType];
  }

  /**
   * Get the balance of a specific currency for a character.
   */
  async getBalance(characterId: string, currencyType: string): Promise<number> {
    try {
      const character = await this.db.character.findUnique({
        where: { id: characterId },
        select: { currency: true },
      });

      if (!character) {
        return this.config.defaults?.[currencyType] ?? 0;
      }

      const currencies = (character.currency as CurrencyBalance) || {};
      return currencies[currencyType] ?? this.config.defaults?.[currencyType] ?? 0;
    } catch (error) {
      this.context.logger.error(`[CurrencySystem] Error getting balance: ${error}`);
      return 0;
    }
  }

  /**
   * Get all currency balances for a character.
   */
  async getAllBalances(characterId: string): Promise<CurrencyBalance> {
    try {
      const character = await this.db.character.findUnique({
        where: { id: characterId },
        select: { currency: true },
      });

      if (!character) {
        return { ...this.config.defaults };
      }

      const currencies = (character.currency as CurrencyBalance) || {};
      // Merge with defaults for currencies not yet set
      return { ...this.config.defaults, ...currencies };
    } catch (error) {
      this.context.logger.error(`[CurrencySystem] Error getting balances: ${error}`);
      return { ...this.config.defaults };
    }
  }

  /**
   * Add currency to a character's balance.
   */
  async add(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction> {
    if (amount < 0) {
      return { success: false, message: 'Amount must be positive. Use remove() to subtract.' };
    }

    if (amount === 0) {
      const balance = await this.getBalance(characterId, currencyType);
      return { success: true, newBalance: balance, previousBalance: balance };
    }

    try {
      const previousBalance = await this.getBalance(characterId, currencyType);
      let newBalance = previousBalance + amount;

      // Check max balance cap
      const def = this.getCurrencyDef(currencyType);
      if (def?.maxBalance !== undefined && newBalance > def.maxBalance) {
        newBalance = def.maxBalance;
      }

      // Get current currency object
      const character = await this.db.character.findUnique({
        where: { id: characterId },
        select: { currency: true },
      });

      const currencies = (character?.currency as CurrencyBalance) || {};
      currencies[currencyType] = newBalance;

      await this.db.character.update({
        where: { id: characterId },
        data: { currency: currencies },
      });

      this.context.events.emit('currency:added', {
        characterId,
        currencyType,
        amount,
        previousBalance,
        newBalance,
      });

      return { success: true, newBalance, previousBalance };
    } catch (error: any) {
      // Handle dev characters that don't exist in DB
      if (error?.code === 'P2025') {
        this.context.logger.debug(`[CurrencySystem] Character ${characterId} not in database (dev mode)`);
        return { success: true, newBalance: amount, previousBalance: 0 };
      }
      this.context.logger.error(`[CurrencySystem] Error adding currency: ${error}`);
      return { success: false, message: `Failed to add currency: ${error}` };
    }
  }

  /**
   * Remove currency from a character's balance.
   */
  async remove(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction> {
    if (amount < 0) {
      return { success: false, message: 'Amount must be positive.' };
    }

    if (amount === 0) {
      const balance = await this.getBalance(characterId, currencyType);
      return { success: true, newBalance: balance, previousBalance: balance };
    }

    try {
      const previousBalance = await this.getBalance(characterId, currencyType);

      // Check minimum balance (usually 0)
      const def = this.getCurrencyDef(currencyType);
      const minBalance = def?.minBalance ?? 0;

      if (previousBalance - amount < minBalance) {
        return {
          success: false,
          message: `Insufficient ${currencyType}. Have: ${previousBalance}, need: ${amount}`,
          previousBalance,
        };
      }

      const newBalance = previousBalance - amount;

      // Get current currency object
      const character = await this.db.character.findUnique({
        where: { id: characterId },
        select: { currency: true },
      });

      const currencies = (character?.currency as CurrencyBalance) || {};
      currencies[currencyType] = newBalance;

      await this.db.character.update({
        where: { id: characterId },
        data: { currency: currencies },
      });

      this.context.events.emit('currency:removed', {
        characterId,
        currencyType,
        amount,
        previousBalance,
        newBalance,
      });

      return { success: true, newBalance, previousBalance };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        this.context.logger.debug(`[CurrencySystem] Character ${characterId} not in database (dev mode)`);
        return { success: false, message: 'Insufficient funds' };
      }
      this.context.logger.error(`[CurrencySystem] Error removing currency: ${error}`);
      return { success: false, message: `Failed to remove currency: ${error}` };
    }
  }

  /**
   * Set a character's currency balance to a specific value.
   */
  async set(characterId: string, currencyType: string, amount: number): Promise<CurrencyTransaction> {
    try {
      const previousBalance = await this.getBalance(characterId, currencyType);

      // Apply min/max caps
      const def = this.getCurrencyDef(currencyType);
      let newBalance = amount;
      if (def?.minBalance !== undefined && newBalance < def.minBalance) {
        newBalance = def.minBalance;
      }
      if (def?.maxBalance !== undefined && newBalance > def.maxBalance) {
        newBalance = def.maxBalance;
      }

      // Get current currency object
      const character = await this.db.character.findUnique({
        where: { id: characterId },
        select: { currency: true },
      });

      const currencies = (character?.currency as CurrencyBalance) || {};
      currencies[currencyType] = newBalance;

      await this.db.character.update({
        where: { id: characterId },
        data: { currency: currencies },
      });

      this.context.events.emit('currency:set', {
        characterId,
        currencyType,
        previousBalance,
        newBalance,
      });

      return { success: true, newBalance, previousBalance };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        this.context.logger.debug(`[CurrencySystem] Character ${characterId} not in database (dev mode)`);
        return { success: true, newBalance: amount, previousBalance: 0 };
      }
      this.context.logger.error(`[CurrencySystem] Error setting currency: ${error}`);
      return { success: false, message: `Failed to set currency: ${error}` };
    }
  }

  /**
   * Check if a character has at least the specified amount.
   */
  async has(characterId: string, currencyType: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(characterId, currencyType);
    return balance >= amount;
  }

  /**
   * Transfer currency between two characters.
   */
  async transfer(
    fromCharacterId: string,
    toCharacterId: string,
    currencyType: string,
    amount: number
  ): Promise<CurrencyTransaction> {
    if (amount <= 0) {
      return { success: false, message: 'Transfer amount must be positive.' };
    }

    if (fromCharacterId === toCharacterId) {
      return { success: false, message: 'Cannot transfer to yourself.' };
    }

    // Check if sender has enough
    const senderBalance = await this.getBalance(fromCharacterId, currencyType);
    if (senderBalance < amount) {
      return {
        success: false,
        message: `Insufficient ${currencyType}. Have: ${senderBalance}, need: ${amount}`,
      };
    }

    // Perform the transfer
    const removeResult = await this.remove(fromCharacterId, currencyType, amount);
    if (!removeResult.success) {
      return removeResult;
    }

    const addResult = await this.add(toCharacterId, currencyType, amount);
    if (!addResult.success) {
      // Rollback the removal
      await this.add(fromCharacterId, currencyType, amount);
      return { success: false, message: 'Transfer failed, funds returned.' };
    }

    this.context.events.emit('currency:transferred', {
      fromCharacterId,
      toCharacterId,
      currencyType,
      amount,
    });

    return {
      success: true,
      message: `Transferred ${amount} ${currencyType}`,
      newBalance: removeResult.newBalance,
      previousBalance: removeResult.previousBalance,
    };
  }

  /**
   * Get the API interface for this system.
   */
  getAPI(): CurrencyAPI {
    return {
      getBalance: this.getBalance.bind(this),
      getAllBalances: this.getAllBalances.bind(this),
      add: this.add.bind(this),
      remove: this.remove.bind(this),
      set: this.set.bind(this),
      has: this.has.bind(this),
      transfer: this.transfer.bind(this),
    };
  }
}
