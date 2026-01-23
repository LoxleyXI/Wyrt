/**
 * @wyrt/ui - Shared UI components for Wyrt games
 *
 * This package provides reusable React components with consistent
 * styling and behavior across all Wyrt game frontends.
 *
 * @example
 * ```tsx
 * import { Modal, Panel, ProgressBar, useModal } from '@wyrt/ui'
 *
 * function MyComponent() {
 *   const { isOpen, open, close } = useModal()
 *
 *   return (
 *     <>
 *       <button onClick={open}>Open</button>
 *       <Modal isOpen={isOpen} onClose={close} title="Hello">
 *         <Panel title="Status">
 *           <ProgressBar value={75} max={100} label="HP" showValue />
 *         </Panel>
 *       </Modal>
 *     </>
 *   )
 * }
 * ```
 */

// Components
export * from './components'

// Hooks
export * from './hooks'
