import { useEffect, useId, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'
import './FeedbackDialog.css'

export type FeedbackDialogVariant = 'info' | 'success' | 'error' | 'danger'

interface FeedbackDialogProps {
  title: string
  message: ReactNode
  variant?: FeedbackDialogVariant
  confirmLabel?: string
  cancelLabel?: string
  onClose: () => void
  onConfirm?: () => void
  isPending?: boolean
}

const variantIcons: Record<FeedbackDialogVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
  danger: XCircle,
}

export function FeedbackDialog({
  title,
  message,
  variant = 'info',
  confirmLabel = '확인',
  cancelLabel,
  onClose,
  onConfirm,
  isPending = false,
}: FeedbackDialogProps) {
  const titleId = useId()
  const Icon = variantIcons[variant]
  const isConfirmDialog = cancelLabel !== undefined

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPending, onClose])

  const handleConfirm = () => {
    if (isPending) return
    if (onConfirm) {
      onConfirm()
      return
    }

    onClose()
  }

  return (
    <div
      role="presentation"
      className="feedback-dialog"
      onClick={() => {
        if (!isPending) onClose()
      }}
    >
      <section
        role={isConfirmDialog ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        className="feedback-dialog__panel"
        onClick={event => event.stopPropagation()}
      >
        <span className="feedback-dialog__tape" aria-hidden="true" />

        <div className="feedback-dialog__content">
          <div
            aria-hidden="true"
            className={`feedback-dialog__icon feedback-dialog__icon--${variant}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="feedback-dialog__text">
            <h2
              id={titleId}
              className="feedback-dialog__title"
            >
              {title}
            </h2>
            <div className="feedback-dialog__message">
              {message}
            </div>
          </div>
        </div>

        <div className="feedback-dialog__actions">
          {cancelLabel && (
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="feedback-dialog__button feedback-dialog__button--cancel"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={`feedback-dialog__button feedback-dialog__button--confirm feedback-dialog__button--${variant}`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
