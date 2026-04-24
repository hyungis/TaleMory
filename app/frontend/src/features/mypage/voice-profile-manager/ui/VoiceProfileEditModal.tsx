import { useEffect, useState } from 'react'
import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  initial: VoiceProfile // 편집 전용 — 추가는 /mypage/voice-clone 라우트에서 처리
  onClose: () => void
  onSave: (draft: Pick<VoiceProfile, 'title'>) => void
}

/**
 * 보이스 프로필 제목 편집 모달 (편집 전용).
 * 신규 보이스는 녹음 플로우가 필요해서 `/mypage/voice-clone` 전용 페이지에서 처리.
 */
export function VoiceProfileEditModal({ initial, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial.title)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title: title.trim() })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-[#e4d4b4]">목소리 편집</h2>

        <label className="block space-y-1">
          <span className="text-sm text-[#b4c4a4]">이름</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="예: 엄마 목소리"
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[#4a3a24] text-[#b4c4a4] hover:bg-[#4a3a24] transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] font-medium hover:bg-[#4cb56c] transition-colors"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  )
}
