import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface NextButtonProps {
  onClick: () => void
  disabled?: boolean
  children?: ReactNode
}

/**
 * 제작 플로우 각 step 하단의 "다음 단계" 버튼.
 * 라벨은 step 마다 다르므로 children 으로 주입 ("사진 선택하러 가기" 등).
 */
export function NextButton({ onClick, disabled, children = '다음 단계' }: NextButtonProps) {
  return (
    <div className="mt-10 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap"
      >
        {children} <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}
