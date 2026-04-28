import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  profile?: VoiceProfile
  isLoading?: boolean
  errorMessage?: string | null
  onClose: () => void
}

export function VoiceProfileDetailsModal({
  profile,
  isLoading = false,
  errorMessage = null,
  onClose,
}: Props) {
  const previewUrl = profile?.ttsVoiceUrl ?? profile?.audioUrl

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-lg rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 space-y-5"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#e4d4b4]">목소리 상세</h2>
            <p className="text-sm text-[#b4c4a4] mt-1">
              저장된 보이스 프로필 정보를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md text-sm text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors"
          >
            닫기
          </button>
        </header>

        {isLoading ? (
          <p className="text-sm text-[#b4c4a4] py-4">목소리 정보를 불러오는 중이에요.</p>
        ) : errorMessage ? (
          <p className="rounded-lg border border-[#8b3a2a]/40 bg-[#8b3a2a]/15 px-4 py-3 text-sm text-[#f0e6c0]">
            {errorMessage}
          </p>
        ) : profile ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-[#b4c4a4]">이름</dt>
              <dd className="text-[#e4d4b4]">{profile.title}</dd>
              <dt className="text-[#b4c4a4]">프로필 ID</dt>
              <dd className="text-[#e4d4b4]">{profile.id}</dd>
              <dt className="text-[#b4c4a4]">저장일</dt>
              <dd className="text-[#e4d4b4]">{formatDateTime(profile.createdAt)}</dd>
              <dt className="text-[#b4c4a4]">수정일</dt>
              <dd className="text-[#e4d4b4]">{formatDateTime(profile.updatedAt)}</dd>
            </dl>

            {previewUrl ? (
              <audio
                controls
                src={previewUrl}
                preload="none"
                className="w-full"
                style={{ colorScheme: 'dark' }}
              />
            ) : (
              <p className="text-xs text-[#6a5a44] italic">
                아직 재생 가능한 오디오가 연결되지 않았어요.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#b4c4a4] py-4">목소리 정보를 찾을 수 없어요.</p>
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
