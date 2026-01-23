'use client'

import React, { useMemo, useState, useCallback } from 'react'

export interface SearchableListProps<T> {
  /** Array of items to display */
  items: T[]
  /** Keys to search within each item */
  searchKeys: (keyof T)[]
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode
  /** Placeholder text for the search input */
  placeholder?: string
  /** Message shown when no items match the search */
  emptyMessage?: string
  /** Message shown when the items array is empty */
  noItemsMessage?: string
  /** Optional icon for empty state */
  emptyIcon?: React.ReactNode
  /** Additional class for the container */
  className?: string
  /** Additional class for the list container */
  listClassName?: string
  /** Whether to show the search input */
  showSearch?: boolean
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void
  /** External search query (controlled mode) */
  searchQuery?: string
  /** Key extractor for stable React keys */
  keyExtractor?: (item: T, index: number) => string | number
}

export function SearchableList<T extends Record<string, unknown>>({
  items,
  searchKeys,
  renderItem,
  placeholder = 'Search...',
  emptyMessage = 'No items match your search',
  noItemsMessage = 'No items available',
  emptyIcon,
  className = '',
  listClassName = '',
  showSearch = true,
  onSearchChange,
  searchQuery: controlledQuery,
  keyExtractor,
}: SearchableListProps<T>) {
  const [internalQuery, setInternalQuery] = useState('')

  // Use controlled or internal query
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value
      if (controlledQuery === undefined) {
        setInternalQuery(newQuery)
      }
      onSearchChange?.(newQuery)
    },
    [controlledQuery, onSearchChange]
  )

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items

    const lowerQuery = query.toLowerCase()

    return items.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key]
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery)
        }
        if (typeof value === 'number') {
          return value.toString().includes(lowerQuery)
        }
        return false
      })
    )
  }, [items, searchKeys, query])

  const getKey = useCallback(
    (item: T, index: number) => {
      if (keyExtractor) return keyExtractor(item, index)
      // Try common ID fields
      if ('id' in item && (typeof item.id === 'string' || typeof item.id === 'number')) {
        return item.id
      }
      return index
    },
    [keyExtractor]
  )

  return (
    <div className={className}>
      {/* Search input */}
      {showSearch && (
        <div className="relative mb-3">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 text-sm rounded bg-[#0d0a07] border border-[#3d2f20] text-white placeholder-gray-600 focus:outline-none focus:border-amber-600"
          />
          {query && (
            <button
              onClick={() => {
                if (controlledQuery === undefined) {
                  setInternalQuery('')
                }
                onSearchChange?.('')
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* List content */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          {emptyIcon && <div className="mb-3 opacity-30">{emptyIcon}</div>}
          <p className="text-sm">{noItemsMessage}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          {emptyIcon && <div className="mb-3 opacity-30">{emptyIcon}</div>}
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className={`space-y-2 ${listClassName}`}>
          {filteredItems.map((item, index) => (
            <React.Fragment key={getKey(item, index)}>
              {renderItem(item, index)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchableList
