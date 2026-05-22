import { useEffect, useRef } from 'react'
import './ConfirmModal.css'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef  = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Auto-focus the safe action (cancel) so Enter doesn't accidentally confirm
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-title"
      aria-describedby="cm-message"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="cm-dialog">
        <h2 id="cm-title" className="cm-title">{title}</h2>
        <p  id="cm-message" className="cm-message">{message}</p>
        <div className="cm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="cm-btn cm-btn--cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`cm-btn ${destructive ? 'cm-btn--destructive' : 'cm-btn--confirm'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
