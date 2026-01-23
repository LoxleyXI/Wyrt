'use client'

import React from 'react'

export interface PanelProps {
  /** Panel title */
  title?: string
  /** Optional icon to show next to the title */
  icon?: React.ReactNode
  /** Optional action button/element in the header */
  headerAction?: React.ReactNode
  /** Panel content */
  children: React.ReactNode
  /** Empty state configuration */
  emptyState?: {
    icon?: React.ReactNode
    message: string
  }
  /** Whether content is loading */
  isLoading?: boolean
  /** Additional class for the panel container */
  className?: string
  /** Whether the panel should be collapsible */
  collapsible?: boolean
  /** Whether the panel is initially collapsed */
  defaultCollapsed?: boolean
  /** Custom theme colors */
  theme?: PanelTheme
}

export interface PanelTheme {
  /** Background color of the panel */
  background?: string
  /** Border color */
  border?: string
  /** Header background */
  headerBackground?: string
  /** Accent color for title */
  accent?: string
}

const DEFAULT_THEME: PanelTheme = {
  background: 'bg-[#141008]',
  border: 'border-[#3d2f20]',
  headerBackground: 'bg-[#1a1510]',
  accent: 'text-amber-400',
}

export function Panel({
  title,
  icon,
  headerAction,
  children,
  emptyState,
  isLoading = false,
  className = '',
  collapsible = false,
  defaultCollapsed = false,
  theme = {},
}: PanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const mergedTheme = { ...DEFAULT_THEME, ...theme }

  const hasHeader = title || icon || headerAction

  return (
    <div
      className={`
        ${mergedTheme.background} rounded-lg border ${mergedTheme.border}
        ${className}
      `}
    >
      {/* Header */}
      {hasHeader && (
        <div
          className={`
            flex items-center justify-between px-4 py-3
            ${mergedTheme.headerBackground}
            ${!isCollapsed ? `border-b ${mergedTheme.border}` : ''}
            ${collapsible ? 'cursor-pointer' : ''}
            rounded-t-lg
          `}
          onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
        >
          <div className="flex items-center gap-2">
            {collapsible && (
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {icon && <span className={mergedTheme.accent}>{icon}</span>}
            {title && (
              <h3 className={`font-semibold ${mergedTheme.accent}`}>{title}</h3>
            )}
          </div>
          {headerAction && !isCollapsed && (
            <div onClick={(e) => e.stopPropagation()}>{headerAction}</div>
          )}
        </div>
      )}

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className={`${mergedTheme.accent} animate-pulse`}>Loading...</div>
            </div>
          ) : emptyState && React.Children.count(children) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              {emptyState.icon && (
                <div className="mb-3 opacity-30">{emptyState.icon}</div>
              )}
              <p className="text-sm">{emptyState.message}</p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

export default Panel
