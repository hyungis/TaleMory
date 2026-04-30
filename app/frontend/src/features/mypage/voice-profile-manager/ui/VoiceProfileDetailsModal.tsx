import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  profile?: VoiceProfile
  isLoading?: boolean
  errorMessage?: string | null
  onClose: () => void
}

/**
 * 목소리 상세 모달 — Pastel Forest 톤.
 */
export function VoiceProfileDetailsModal({
  profile,
  isLoading = false,
  errorMessage = null,
  onClose,
}: Props) {
  const previewUrl = profile?.ttsVoiceUrl ?? profile?.audioUrl

  return (
    <div
      className="fixed inset-0 z-50 bg-[#3E2A18]/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-lg rounded-3xl bg-[#FFFEF8] border-2 border-[#B9D38F]/55 shadow-[0_12px_32px_rgba(154,117,72,0.25)] p-6 space-y-5"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#3E2A18]">목소리 상세</h2>
            <p className="text-sm text-[#6B4A28] mt-1">
              저장된 보이스 프로필 정보를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md text-sm font-bold text-[#6B4A28] hover:bg-[#E9DBBE] hover:text-[#3E2A18] transition-colors"
          >
            닫기
          </button>
        </header>

        {isLoading ? (
          <p className="text-sm text-[#6B4A28] py-4">목소리 정보를 불러오는 중이에요.</p>
        ) : errorMessage ? (
          <p className="rounded-xl border-2 border-[#a3413f]/40 bg-[#F4E4BC] px-4 py-3 text-sm text-[#a3413f] font-bold">
            {errorMessage}
          </p>
        ) : profile ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-[#6B4A28] font-bold">이름</dt>
              <dd className="text-[#3E2A18] font-bold">{profile.title}</dd>
              <dt className="text-[#6B4A28] font-bold">프로필 ID</dt>
              <dd className="text-[#3E2A18] font-bold">{profile.id}</dd>
              <dt className="text-[#6B4A28] font-bold">저장일</dt>
              <dd className="text-[#3E2A18] font-bold">{formatDateTime(profile.createdAt)}</dd>
              <dt className="text-[#6B4A28] font-bold">수정일</dt>
              <dd className="text-[#3E2A18] font-bold">{formatDateTime(profile.updatedAt)}</dd>
            </dl>

            {previewUrl ? (
              <audio
                controls
                src={previewUrl}
                preload="none"
                className="w-full"
              />
            ) : (
              <p className="text-xs text-[#9A7548] italic">
                아직 재생 가능한 오디오가 연결되지 않았어요.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#6B4A28] py-4">목소리 정보를 찾을 수 없어요.</p>
        )}
      </section>
    </div>
  )
}

function formatDateTime(value?: string): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
