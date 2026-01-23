'use client'

import { useState, useMemo, useCallback } from 'react'

export interface UseSearchOptions<T> {
  /** Initial search query */
  initialQuery?: string
  /** Keys to search within each item */
  searchKeys: (keyof T)[]
  /** Whether the search is case-sensitive */
  caseSensitive?: boolean
  /** Debounce delay in milliseconds */
  debounceMs?: number
}

export interface UseSearchReturn<T> {
  /** Current search query */
  query: string
  /** Set the search query */
  setQuery: (query: string) => void
  /** Clear the search query */
  clearQuery: () => void
  /** Filter function to apply to items */
  filter: (items: T[]) => T[]
  /** Filtered items (if items are provided) */
  filteredItems: T[]
}

/**
 * Hook for filtering items based on a search query.
 *
 * @example
 * ```tsx
 * const items = [{ name: 'Sword', type: 'weapon' }, { name: 'Potion', type: 'consumable' }]
 * const { query, setQuery, filteredItems } = useSearch({
 *   items,
 *   searchKeys: ['name', 'type'],
 * })
 *
 * return (
 *   <>
 *     <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *     {filteredItems.map(item => <div>{item.name}</div>)}
 *   </>
 * )
 * ```
 */
export function useSearch<T extends Record<string, unknown>>(
  items: T[],
  options: UseSearchOptions<T>
): UseSearchReturn<T> {
  const { initialQuery = '', searchKeys, caseSensitive = false } = options
  const [query, setQueryState] = useState(initialQuery)

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
  }, [])

  const clearQuery = useCallback(() => {
    setQueryState('')
  }, [])

  const filter = useCallback(
    (itemsToFilter: T[]): T[] => {
      if (!query.trim()) return itemsToFilter

      const searchQuery = caseSensitive ? query : query.toLowerCase()

      return itemsToFilter.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key]
          if (typeof value === 'string') {
            const searchValue = caseSensitive ? value : value.toLowerCase()
            return searchValue.includes(searchQuery)
          }
          if (typeof value === 'number') {
            return value.toString().includes(searchQuery)
          }
          return false
        })
      )
    },
    [query, searchKeys, caseSensitive]
  )

  const filteredItems = useMemo(() => filter(items), [filter, items])

  return {
    query,
    setQuery,
    clearQuery,
    filter,
    filteredItems,
  }
}

export default useSearch
