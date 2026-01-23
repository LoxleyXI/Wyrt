'use client'

import React, { useCallback, useEffect, useRef } from 'react'

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Modal title */
  title: string
  /** Optional icon to show next to the title */
  icon?: React.ReactNode
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Modal content */
  children: React.ReactNode
  /** Optional footer content */
  footer?: React.ReactNode
  /** Whether content is loading */
  isLoading?: boolean
  /** Error message to display */
  error?: string | null
  /** Additional class for the modal container */
  className?: string
  /** Whether to close on escape key */
  closeOnEscape?: boolean
  /** Whether to close when clicking the backdrop */
  closeOnBackdrop?: boolean
  /** Custom theme colors */
  theme?: ModalTheme
}

export interface ModalTheme {
  /** Background color of the modal */
  background?: string
  /** Border color */
  border?: string
  /** Accent color for title and buttons */
  accent?: string
  /** Backdrop color/opacity */
  backdrop?: string
}

const DEFAULT_THEME: ModalTheme = {
  background: 'bg-[#141008]',
  border: 'border-[#3d2f20]',
  accent: 'text-amber-400',
  backdrop: 'bg-black/70',
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
}

export function Modal({
  isOpen,
  onClose,
  title,
  icon,
  size = 'lg',
  children,
  footer,
  isLoading = false,
  error = null,
  className = '',
  closeOnEscape = true,
  closeOnBackdrop = true,
  theme = {},
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const mergedTheme = { ...DEFAULT_THEME, ...theme }

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose()
      }
    },
    [closeOnBackdrop, onClose]
  )

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${mergedTheme.backdrop} backdrop-blur-sm`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`
          w-full ${SIZE_CLASSES[size]} max-h-[90vh] flex flex-col
          ${mergedTheme.background} rounded-lg shadow-2xl
          border ${mergedTheme.border}
          ${error ? 'ring-2 ring-red-500' : ''}
          ${className}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${mergedTheme.border}`}>
          <div className="flex items-center gap-3">
            {icon && <span className={mergedTheme.accent}>{icon}</span>}
            <h2 id="modal-title" className={`text-lg font-semibold ${mergedTheme.accent}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-900/50 text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className={`${mergedTheme.accent} animate-pulse`}>Loading...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">{children}</div>
        )}

        {/* Footer */}
        {footer && (
          <div className={`px-4 py-3 border-t ${mergedTheme.border}`}>{footer}</div>
        )}
      </div>
    </div>
  )
}

export default Modal
