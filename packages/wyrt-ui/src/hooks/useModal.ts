'use client'

import { useState, useCallback } from 'react'

export interface UseModalOptions {
  /** Initial open state */
  defaultOpen?: boolean
  /** Callback when modal opens */
  onOpen?: () => void
  /** Callback when modal closes */
  onClose?: () => void
}

export interface UseModalReturn {
  /** Whether the modal is open */
  isOpen: boolean
  /** Open the modal */
  open: () => void
  /** Close the modal */
  close: () => void
  /** Toggle the modal */
  toggle: () => void
  /** Set the open state directly */
  setOpen: (open: boolean) => void
}

/**
 * Hook for managing modal open/close state.
 *
 * @example
 * ```tsx
 * const { isOpen, open, close } = useModal()
 *
 * return (
 *   <>
 *     <button onClick={open}>Open Modal</button>
 *     <Modal isOpen={isOpen} onClose={close} title="My Modal">
 *       Content here
 *     </Modal>
 *   </>
 * )
 * ```
 */
export function useModal(options: UseModalOptions = {}): UseModalReturn {
  const { defaultOpen = false, onOpen, onClose } = options
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const open = useCallback(() => {
    setIsOpen(true)
    onOpen?.()
  }, [onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        onOpen?.()
      } else {
        onClose?.()
      }
      return next
    })
  }, [onOpen, onClose])

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) {
        onOpen?.()
      } else {
        onClose?.()
      }
    },
    [onOpen, onClose]
  )

  return { isOpen, open, close, toggle, setOpen }
}

export default useModal
