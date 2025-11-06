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
    connection: any
    context: any
}

export type CharacterCreateHook = (
    data: CharacterCreateData,
    connection: any
) => Promise<void>

export type CharacterSelectHook = (
    data: CharacterSelectData
) => Promise<void>

export interface ModuleHooks {
    onCharacterCreate?: CharacterCreateHook
    onCharacterSelect?: CharacterSelectHook
    onCharacterDelete?: (characterId: number, connection: any) => Promise<void>
    onCharacterLogin?: (characterId: number, connection: any) => Promise<void>
}
