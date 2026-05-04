export type TermsKey = 'serviceTermsAgree' | 'privacyAgree'

export interface TermAgreement {
  termId: number
  agreed: boolean
}

export const REQUIRED_TERM_IDS = {
  serviceTerms: 1,
  privacy: 2,
} as const

interface TermsCheckboxesProps {
  serviceTermsAgree: boolean
  privacyAgree: boolean
  onChange: (key: TermsKey, value: boolean) => void
}

export function buildRequiredTermAgreements(values: {
  serviceTermsAgree: boolean
  privacyAgree: boolean
}): TermAgreement[] {
  return [
    { termId: REQUIRED_TERM_IDS.serviceTerms, agreed: values.serviceTermsAgree },
    { termId: REQUIRED_TERM_IDS.privacy, agreed: values.privacyAgree },
  ]
}

/**
 * 회원가입 약관 체크박스 — paper-craft 톤.
 */
export function TermsCheckboxes({
  serviceTermsAgree,
  privacyAgree,
  onChange,
}: TermsCheckboxesProps) {
  return (
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
        required
      />
      <CheckboxRow
        checked={privacyAgree}
        onChange={v => onChange('privacyAgree', v)}
        label="개인정보 수집 및 이용에 동의합니다"
        required
      />
    </div>
  )
}

function CheckboxRow({
  checked,
  onChange,
  label,
  required = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  required?: boolean
}) {
  return (
    <label
      className="flex items-center cursor-pointer select-none"
      style={{ gap: 10 }}
    >
      <input
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
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          color: required ? '#c47254' : '#a37548',
          fontWeight: required ? 700 : 400,
        }}
      >
        {required ? '(필수)' : '(선택)'}
      </span>
    </label>
  )
}
