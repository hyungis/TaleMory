export type TermsKey = 'smsAgree' | 'marketingAgree'

interface TermsCheckboxesProps {
  smsAgree: boolean
  marketingAgree: boolean
  onChange: (key: TermsKey, value: boolean) => void
}

/**
 * 회원가입 시 선택 동의 체크박스 영역 (SMS 수신 / 마케팅 정보 수신).
 * TODO(S14P31S210-75): 백엔드 `/api/terms` 조회 응답에 따라 동적 렌더링하도록 확장.
 */
export function TermsCheckboxes({ smsAgree, marketingAgree, onChange }: TermsCheckboxesProps) {
  return (
    <div className="bg-[#e8ddb4] border-2 border-[#8b7a52]/40 rounded-xl p-4 space-y-2.5">
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={smsAgree}
          onChange={e => onChange('smsAgree', e.target.checked)}
          className="w-4 h-4 accent-[#2d5a27] cursor-pointer"
        />
        <span className="text-sm text-[#2d5a27] font-bold">SMS 수신에 동의합니다</span>
        <span className="text-xs text-[#8b7a52] ml-auto">(선택)</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={marketingAgree}
          onChange={e => onChange('marketingAgree', e.target.checked)}
          className="w-4 h-4 accent-[#2d5a27] cursor-pointer"
        />
        <span className="text-sm text-[#2d5a27] font-bold">마케팅 정보 수신에 동의합니다</span>
        <span className="text-xs text-[#8b7a52] ml-auto">(선택)</span>
      </label>
    </div>
  )
}
