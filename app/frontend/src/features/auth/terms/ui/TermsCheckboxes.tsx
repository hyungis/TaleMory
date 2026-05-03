export type TermsKey = 'smsAgree' | 'marketingAgree'

interface TermsCheckboxesProps {
  smsAgree: boolean
  marketingAgree: boolean
  onChange: (key: TermsKey, value: boolean) => void
}

/**
 * 회원가입 시 선택 동의 체크박스 — paper-craft 톤.
 */
export function TermsCheckboxes({ smsAgree, marketingAgree, onChange }: TermsCheckboxesProps) {
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
        checked={smsAgree}
        onChange={v => onChange('smsAgree', v)}
        label="SMS 수신에 동의합니다"
      />
      <CheckboxRow
        checked={marketingAgree}
        onChange={v => onChange('marketingAgree', v)}
        label="마케팅 정보 수신에 동의합니다"
      />
    </div>
  )
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
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
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#a37548' }}>
        (선택)
      </span>
    </label>
  )
}
