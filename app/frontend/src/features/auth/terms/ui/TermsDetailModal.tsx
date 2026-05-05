import type { TermDetail } from '../model/termDetails'

interface TermsDetailModalProps {
  term: TermDetail
  onClose: () => void
}

export function TermsDetailModal({ term, onClose }: TermsDetailModalProps) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(35, 29, 22, 0.42)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`terms-detail-${term.slug}`}
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(720px, 86vh)',
          overflow: 'auto',
          borderRadius: 18,
          border: '2px solid rgba(122, 94, 61, 0.28)',
          background: '#fffaf0',
          boxShadow: '0 24px 60px rgba(54, 39, 24, 0.28)',
          padding: 24,
        }}
      >
        <header style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={`terms-detail-${term.slug}`}
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: '#3f3325',
                lineHeight: 1.25,
              }}
            >
              {term.title}
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13,
                color: '#9b8467',
                lineHeight: 1.5,
              }}
            >
              시행일 {term.effectiveDate}
            </p>
          </div>
          <button
            type="button"
            aria-label="약관 상세 닫기"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              border: '1px solid rgba(122, 94, 61, 0.2)',
              borderRadius: 999,
              background: '#f7eccd',
              color: '#5c4932',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: '30px',
            }}
          >
            ×
          </button>
        </header>

        <p
          style={{
            margin: '18px 0 16px',
            padding: '14px 16px',
            borderRadius: 12,
            background: '#f7eccd',
            color: '#4a3b2a',
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          {term.summary}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {term.sections.map(section => (
            <section
              key={section.title}
              style={{
                borderRadius: 12,
                border: '1px solid rgba(122, 94, 61, 0.16)',
                background: '#fffdf8',
                padding: '14px 16px',
              }}
            >
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  color: '#4a3b2a',
                  lineHeight: 1.35,
                }}
              >
                {section.title}
              </h3>
              {section.body.map(paragraph => (
                <p
                  key={paragraph}
                  style={{
                    margin: '6px 0 0',
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: '#5d4b35',
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
