'use client'

import React from 'react'

export interface ModalFooterProps {
  children: React.ReactNode
  className?: string
  /** Alignment of footer content */
  align?: 'left' | 'center' | 'right' | 'between'
}

const ALIGN_CLASSES = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
}

export function ModalFooter({ children, className = '', align = 'between' }: ModalFooterProps) {
  return (
    <div className={`flex items-center ${ALIGN_CLASSES[align]} px-4 py-3 ${className}`}>
      {children}
    </div>
  )
}

export default ModalFooter
