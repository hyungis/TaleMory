import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { TermsKey } from '../model/termAgreements'
import type { TermDetail, TermDetailSlug } from '../model/termDetails'
import { useTermsQuery } from '../model/useTermsQuery'
import { TermsDetailModal } from './TermsDetailModal'

interface TermsCheckboxesProps {
  serviceTermsAgree: boolean
  privacyAgree: boolean
  onChange: (key: TermsKey, value: boolean) => void
}

/**
 * 회원가입 약관 체크박스 — paper-craft 톤.
 */
export function TermsCheckboxes({
  serviceTermsAgree,
  privacyAgree,
  onChange,
}: TermsCheckboxesProps) {
  const [selectedTerm, setSelectedTerm] = useState<TermDetail | null>(null)
  const [loadingTermSlug, setLoadingTermSlug] = useState<TermDetailSlug | null>(null)
  const { data: terms = [], refetch } = useTermsQuery({ enabled: false })
  const serviceTerm = terms.find(term => term.slug === 'service')
  const privacyTerm = terms.find(term => term.slug === 'privacy')

  const handleOpenDetail = async (slug: TermDetailSlug) => {
    if (loadingTermSlug !== null) return

    setLoadingTermSlug(slug)
    setSelectedTerm(null)

    try {
      const result = await refetch()
      if (result.isError) throw result.error

      const term = result.data?.find(item => item.slug === slug)
      if (term === undefined) {
        window.alert('약관 상세 내용을 찾지 못했어요. 잠시 후 다시 시도해주세요.')
        return
      }

      setSelectedTerm(term)
    } catch {
      window.alert('약관 상세 내용을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoadingTermSlug(null)
    }
  }

  return (
    <>
      <div
        style={{
          background: '#f7eccd',
          border: '2px solid rgba(163, 117, 72, 0.45)',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <CheckboxRow
          checked={serviceTermsAgree}
          onChange={v => onChange('serviceTermsAgree', v)}
          label={`${serviceTerm?.title ?? '서비스 이용약관'}에 동의합니다`}
          detailSlug="service"
          isDetailLoading={loadingTermSlug !== null}
          onOpenDetail={() => handleOpenDetail('service')}
          required
        />
        <CheckboxRow
          checked={privacyAgree}
          onChange={v => onChange('privacyAgree', v)}
          label={`${privacyTerm?.title ?? '개인정보 수집 및 이용'}에 동의합니다`}
          detailSlug="privacy"
          isDetailLoading={loadingTermSlug !== null}
          onOpenDetail={() => handleOpenDetail('privacy')}
          required
        />
      </div>
      {loadingTermSlug !== null && selectedTerm === null && (
        <TermsDetailLoadingModal
          title={loadingTermSlug === 'service' ? '서비스 이용약관' : '개인정보 수집 및 이용'}
        />
      )}
      {selectedTerm && (
        <TermsDetailModal
          term={selectedTerm}
          onClose={() => setSelectedTerm(null)}
        />
      )}
    </>
  )
}

function CheckboxRow({
  checked,
  onChange,
  label,
  detailSlug,
  isDetailLoading,
  onOpenDetail,
  required = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  detailSlug: TermDetailSlug
  isDetailLoading: boolean
  onOpenDetail: () => void
  required?: boolean
}) {
  return (
    <div
      className="flex items-center select-none"
      style={{ gap: 10 }}
    >
      <span
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          color: required ? '#c47254' : '#a37548',
          fontWeight: required ? 700 : 400,
        }}
      >
        {required ? '(필수)' : '(선택)'}
      </span>
      <input
        id={`terms-${detailSlug}`}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{
          width: 18,
          height: 18,
          accentColor: '#7a9968',
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          color: '#4a3b2a',
          fontWeight: 700,
          flex: 1,
          minWidth: 0,
        }}
      >
        <label htmlFor={`terms-${detailSlug}`} style={{ cursor: 'pointer' }}>
          {label}
        </label>
      </span>
      <a
        href={`#terms-${detailSlug}-detail`}
        aria-disabled={isDetailLoading}
        onClick={event => {
          event.preventDefault()
          if (!isDetailLoading) onOpenDetail()
        }}
        style={{
          flexShrink: 0,
          padding: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          color: '#5f7d50',
          fontWeight: 700,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          cursor: isDetailLoading ? 'default' : 'pointer',
        }}
      >
        상세히 보기
      </a>
    </div>
  )
}

function TermsDetailLoadingModal({ title }: { title: string }) {
  return (
    <div
      role="presentation"
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
        role="status"
        aria-live="polite"
        style={{
          width: 'min(360px, 100%)',
          borderRadius: 18,
          border: '2px solid rgba(122, 94, 61, 0.28)',
          background: '#fffaf0',
          boxShadow: '0 24px 60px rgba(54, 39, 24, 0.28)',
          padding: '26px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <LoaderCircle
          className="h-8 w-8 animate-spin"
          aria-hidden="true"
          color="#5f7d50"
          strokeWidth={2.4}
        />
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 700,
            color: '#4a3b2a',
            lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          {title}을 불러오는 중입니다.
        </p>
      </section>
    </div>
  )
}
