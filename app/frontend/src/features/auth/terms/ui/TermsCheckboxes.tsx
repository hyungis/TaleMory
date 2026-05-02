import '../../styles/auth.css'

export type TermsKey = 'smsAgree' | 'marketingAgree'

interface TermsCheckboxesProps {
  smsAgree: boolean
  marketingAgree: boolean
  onChange: (key: TermsKey, value: boolean) => void
}

/**
 * 회원가입 시 선택 동의 체크박스 — paper-craft 톤.
 * 스타일은 `auth.css` 의 `auth-terms` / `auth-checkbox-row` 클래스 사용.
 */
export function TermsCheckboxes({ smsAgree, marketingAgree, onChange }: TermsCheckboxesProps) {
  return (
    <div className="auth-terms">
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
    <label className="auth-checkbox-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="label">{label}</span>
      <span className="optional">(선택)</span>
    </label>
  )
}
