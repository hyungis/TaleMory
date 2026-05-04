import { useState } from 'react'
import type { TermsKey } from '../model/termAgreements'
import { TERM_DETAILS, type TermDetail, type TermDetailSlug } from '../model/termDetails'
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
          label="서비스 이용약관에 동의합니다"
          detailSlug="service"
          onOpenDetail={setSelectedTerm}
          required
        />
        <CheckboxRow
          checked={privacyAgree}
          onChange={v => onChange('privacyAgree', v)}
          label="개인정보 수집 및 이용에 동의합니다"
          detailSlug="privacy"
          onOpenDetail={setSelectedTerm}
          required
        />
      </div>
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
  onOpenDetail,
  required = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  detailSlug: TermDetailSlug
  onOpenDetail: (term: TermDetail) => void
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
      <button
        type="button"
        onClick={() => onOpenDetail(TERM_DETAILS[detailSlug])}
        style={{
          flexShrink: 0,
          border: 0,
          background: 'transparent',
          padding: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          color: '#5f7d50',
          fontWeight: 700,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          cursor: 'pointer',
        }}
      >
        상세히 보기
      </button>
    </div>
  )
}
