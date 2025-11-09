/**
 * Module lifecycle hooks
 */

export interface CharacterCreateData {
    characterId: number
    name: string
    class: string
    accountId: number
}

export interface CharacterSelectData {
    user: any  // User object
    character: any  // Base character record from DB
    db: any  // mysql2/promise connection
    context: any
}

export type CharacterCreateHook = (
    data: CharacterCreateData,
    db: any  // mysql2/promise connection
) => Promise<void>

export type CharacterSelectHook = (
    data: CharacterSelectData
) => Promise<void>

export interface ModuleHooks {
    onCharacterCreate?: CharacterCreateHook
    onCharacterSelect?: CharacterSelectHook
    onCharacterDelete?: (characterId: number, db: any) => Promise<void>
    onCharacterLogin?: (characterId: number, db: any) => Promise<void>
}
