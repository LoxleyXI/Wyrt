'use client'

import React from 'react'

export interface ModalBodyProps {
  children: React.ReactNode
  className?: string
  /** Whether to add default padding */
  padded?: boolean
}

export function ModalBody({ children, className = '', padded = true }: ModalBodyProps) {
  return (
    <div className={`flex-1 overflow-y-auto ${padded ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  )
}

export default ModalBody
