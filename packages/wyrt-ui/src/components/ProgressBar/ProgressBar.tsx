'use client'

import React from 'react'

export interface ProgressBarProps {
  /** Current value */
  value: number
  /** Maximum value */
  max: number
  /** Optional label */
  label?: string
  /** Whether to show the value text */
  showValue?: boolean
  /** Format function for the value display */
  formatValue?: (value: number, max: number) => string
  /** Size of the progress bar */
  size?: 'sm' | 'md' | 'lg'
  /** Color variant */
  variant?: 'default' | 'health' | 'mana' | 'xp' | 'danger' | 'success'
  /** Additional class for the container */
  className?: string
  /** Whether to animate the bar */
  animated?: boolean
}

const SIZE_CLASSES = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const VARIANT_CLASSES = {
  default: 'bg-amber-500',
  health: 'bg-red-500',
  mana: 'bg-blue-500',
  xp: 'bg-purple-500',
  danger: 'bg-red-600',
  success: 'bg-green-500',
}

const TRACK_CLASSES = {
  default: 'bg-[#1a1510]',
  health: 'bg-red-900/30',
  mana: 'bg-blue-900/30',
  xp: 'bg-purple-900/30',
  danger: 'bg-red-900/30',
  success: 'bg-green-900/30',
}

export function ProgressBar({
  value,
  max,
  label,
  showValue = false,
  formatValue,
  size = 'md',
  variant = 'default',
  className = '',
  animated = false,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const displayValue = formatValue
    ? formatValue(value, max)
    : `${value}/${max}`

  return (
    <div className={`w-full ${className}`}>
      {/* Label and value row */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-gray-400">{label}</span>}
          {showValue && (
            <span className="text-xs text-gray-300 tabular-nums">{displayValue}</span>
          )}
        </div>
      )}

      {/* Progress track */}
      <div
        className={`
          w-full rounded-full overflow-hidden
          ${SIZE_CLASSES[size]}
          ${TRACK_CLASSES[variant]}
        `}
      >
        {/* Progress bar */}
        <div
          className={`
            h-full rounded-full
            ${VARIANT_CLASSES[variant]}
            ${animated ? 'transition-all duration-300 ease-out' : ''}
          `}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}

export default ProgressBar
