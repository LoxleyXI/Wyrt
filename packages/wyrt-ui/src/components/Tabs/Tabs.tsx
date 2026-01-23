'use client'

import React, { useState, useCallback } from 'react'

export interface Tab {
  /** Unique identifier for the tab */
  id: string
  /** Display label for the tab */
  label: string
  /** Optional icon */
  icon?: React.ReactNode
  /** Whether the tab is disabled */
  disabled?: boolean
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: Tab[]
  /** Currently active tab ID */
  activeTab?: string
  /** Callback when active tab changes */
  onTabChange?: (tabId: string) => void
  /** Children function that receives the active tab ID */
  children?: (activeTabId: string) => React.ReactNode
  /** Additional class for the tabs container */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Visual variant */
  variant?: 'underline' | 'pills' | 'enclosed'
  /** Theme colors */
  theme?: TabsTheme
}

export interface TabsTheme {
  /** Active tab text color */
  activeText?: string
  /** Inactive tab text color */
  inactiveText?: string
  /** Active indicator color (underline/pill background) */
  activeIndicator?: string
  /** Border color */
  border?: string
}

const DEFAULT_THEME: TabsTheme = {
  activeText: 'text-amber-400',
  inactiveText: 'text-gray-500',
  activeIndicator: 'border-amber-400',
  border: 'border-[#3d2f20]',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Tabs({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  children,
  className = '',
  size = 'md',
  variant = 'underline',
  theme = {},
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id ?? '')
  const mergedTheme = { ...DEFAULT_THEME, ...theme }

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(tabId)
      }
      onTabChange?.(tabId)
    },
    [controlledActiveTab, onTabChange]
  )

  const getTabClasses = (tab: Tab): string => {
    const isActive = tab.id === activeTab
    const isDisabled = tab.disabled

    const baseClasses = `
      flex items-center gap-2 font-medium transition-colors whitespace-nowrap
      ${SIZE_CLASSES[size]}
      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `

    switch (variant) {
      case 'underline':
        return `
          ${baseClasses}
          border-b-2 -mb-[2px]
          ${isActive ? `${mergedTheme.activeText} ${mergedTheme.activeIndicator}` : ''}
          ${!isActive && !isDisabled ? `${mergedTheme.inactiveText} border-transparent hover:text-gray-300` : ''}
        `
      case 'pills':
        return `
          ${baseClasses}
          rounded-full
          ${isActive ? `bg-amber-600 text-white` : ''}
          ${!isActive && !isDisabled ? `${mergedTheme.inactiveText} hover:bg-white/5 hover:text-gray-300` : ''}
        `
      case 'enclosed':
        return `
          ${baseClasses}
          rounded-t-lg border border-b-0
          ${isActive ? `${mergedTheme.activeText} bg-[#141008] border-[#3d2f20]` : ''}
          ${!isActive && !isDisabled ? `${mergedTheme.inactiveText} border-transparent hover:text-gray-300` : ''}
        `
      default:
        return baseClasses
    }
  }

  return (
    <div className={className}>
      {/* Tab list */}
      <div
        className={`
          flex overflow-x-auto
          ${variant === 'underline' ? `border-b ${mergedTheme.border}` : ''}
          ${variant === 'pills' ? 'gap-1 p-1 bg-[#0d0a07] rounded-full' : ''}
          ${variant === 'enclosed' ? `border-b ${mergedTheme.border}` : ''}
        `}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`tabpanel-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && handleTabClick(tab.id)}
            className={getTabClasses(tab)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {children && (
        <div role="tabpanel" id={`tabpanel-${activeTab}`}>
          {children(activeTab)}
        </div>
      )}
    </div>
  )
}

export default Tabs
