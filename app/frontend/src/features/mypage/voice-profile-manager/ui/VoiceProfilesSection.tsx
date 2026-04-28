import { useState } from 'react'
import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  voiceProfiles: VoiceProfile[]
  onAddClick: () => void
  onDetailsClick?: (profile: VoiceProfile) => void
  onEditClick?: (profile: VoiceProfile) => void
  onDeleteClick?: (profile: VoiceProfile) => void
  isLoading?: boolean
  isBusy?: boolean
}

export function VoiceProfilesSection({
  voiceProfiles,
  onAddClick,
  onDetailsClick,
  onEditClick,
  onDeleteClick,
  isLoading = false,
  isBusy = false,
}: Props) {
  return (
    <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#e4d4b4]">목소리 보관함</h2>
          <p className="text-sm text-[#b4c4a4] mt-1">저장한 녹음과 TTS 샘플을 다시 들어볼 수 있어요.</p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          disabled={isBusy}
          className="px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + 목소리 추가
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-[#b4c4a4] px-1 py-4">목소리 목록을 불러오는 중이에요.</p>
      ) : voiceProfiles.length === 0 ? (
        <p className="text-sm text-[#6a5a44] italic px-1 py-4">아직 저장된 목소리가 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {voiceProfiles.map(profile => (
            <VoiceProfileCard
              key={profile.id}
              profile={profile}
              onDetails={onDetailsClick}
              onEdit={onEditClick}
              onDelete={onDeleteClick}
              isBusy={isBusy}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function VoiceProfileCard({
  profile,
  onDetails,
  onEdit,
  onDelete,
  isBusy,
}: {
  profile: VoiceProfile
  onDetails?: (profile: VoiceProfile) => void
  onEdit?: (profile: VoiceProfile) => void
  onDelete?: (profile: VoiceProfile) => void
  isBusy: boolean
}) {
  const previewUrl = profile.ttsVoiceUrl ?? profile.audioUrl
  const hasPreview = typeof previewUrl === 'string' && previewUrl.length > 0
  const [failed, setFailed] = useState(false)

  return (
    <li className="rounded-xl bg-[#1a0f08] border border-[#4a3a24] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#3ca55c]/20 border border-[#3ca55c] text-[#3ca55c] text-lg flex items-center justify-center shrink-0">
          음
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#e4d4b4] font-medium truncate">{profile.title}</p>
          <p className="text-xs text-[#b4c4a4] truncate">
            {profile.ttsVoiceUrl ? 'TTS 미리듣기 가능' : '원본 녹음본'}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {onDetails && (
            <button
              type="button"
              onClick={() => onDetails(profile)}
              disabled={isBusy}
              className="px-2 py-1 rounded-md text-xs text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              상세
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(profile)}
              disabled={isBusy}
              className="px-2 py-1 rounded-md text-xs text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              수정
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(profile)}
              disabled={isBusy}
              className="px-2 py-1 rounded-md text-xs text-[#e85c5c] hover:bg-[#e85c5c] hover:text-[#1a0f08] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {hasPreview ? (
        <>
          <audio
            controls
            src={previewUrl}
            preload="none"
            onError={() => setFailed(true)}
            className="w-full"
            style={{ colorScheme: 'dark' }}
          />
          {failed && (
            <p className="text-xs text-[#6a5a44] italic">
              오디오를 재생할 수 없어요. 저장된 파일 주소를 다시 확인해 주세요.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-[#6a5a44] italic">
          아직 재생 가능한 오디오가 연결되지 않았어요.
        </p>
      )}
    </li>
  )
}
