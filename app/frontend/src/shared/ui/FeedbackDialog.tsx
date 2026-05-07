import { useEffect, useId, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

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

const variantStyles: Record<
  FeedbackDialogVariant,
  {
    color: string
    background: string
    border: string
    Icon: typeof Info
  }
> = {
  info: {
    color: '#5f7d50',
    background: '#eef5df',
    border: '#5f7d50',
    Icon: Info,
  },
  success: {
    color: '#5f7d50',
    background: '#eef5df',
    border: '#5f7d50',
    Icon: CheckCircle2,
  },
  error: {
    color: '#8c3a1f',
    background: '#fff0e8',
    border: '#c47254',
    Icon: AlertCircle,
  },
  danger: {
    color: '#8c3a1f',
    background: '#fff0e8',
    border: '#c47254',
    Icon: XCircle,
  },
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
  const style = variantStyles[variant]
  const Icon = style.Icon
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
      onClick={() => {
        if (!isPending) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10080,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(74, 59, 42, 0.55)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <section
        role={isConfirmDialog ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          position: 'relative',
          borderRadius: 20,
          border: '2.5px solid #a37548',
          background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
          boxShadow: '0 4px 0 #a37548, 0 16px 40px rgba(74, 59, 42, 0.32)',
          padding: '24px',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -13,
            left: 28,
            width: 86,
            height: 24,
            background: 'rgba(255, 230, 140, 0.72)',
            border: '1px dashed rgba(150, 110, 50, 0.35)',
            transform: 'rotate(-5deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 14,
              border: `2px solid ${style.border}`,
              background: style.background,
              color: style.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 0 ${style.border}`,
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id={titleId}
              style={{
                margin: '0 0 8px',
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: '#4a3b2a',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                lineHeight: 1.55,
                color: '#5c4932',
                wordBreak: 'keep-all',
              }}
            >
              {message}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 22,
          }}
        >
          {cancelLabel && (
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                minWidth: 92,
                borderRadius: 999,
                border: '2px solid #a37548',
                background: '#f7eccd',
                color: '#6b5638',
                padding: '10px 18px',
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 700,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              minWidth: 92,
              borderRadius: 999,
              border: `2px solid ${variant === 'danger' ? '#8a4a32' : '#5f7d50'}`,
              background: variant === 'danger' ? '#c47254' : '#7a9968',
              color: '#fdfaf0',
              padding: '10px 18px',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              boxShadow:
                variant === 'danger'
                  ? '0 3px 0 #8a4a32, 0 6px 12px rgba(140, 60, 40, 0.25)'
                  : '0 3px 0 #5f7d50, 0 6px 12px rgba(95, 125, 80, 0.22)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
