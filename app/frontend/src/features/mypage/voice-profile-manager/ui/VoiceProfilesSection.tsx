import { useState } from 'react'
import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  voiceProfiles: VoiceProfile[]
  onAddClick: () => void
  onEditClick: (profile: VoiceProfile) => void
  onDeleteClick: (profile: VoiceProfile) => void
}

/**
 * 보이스 프로필 섹션.
 * 각 카드에 네이티브 `<audio controls>` 항상 노출 — mock URL 이어도 UI 는 그대로 보임.
 * ttsVoiceUrl 이 있으면 우선 사용 (TTS 결과물), 없으면 원본 audioUrl.
 */
export function VoiceProfilesSection({
  voiceProfiles,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: Props) {
  // 마이페이지에선 TTS 변환이 완료된 목소리만 노출 — 원본 녹음만 있는 항목은 숨김.
  const tts = voiceProfiles.filter((v) => !!v.ttsVoiceUrl)

  return (
    <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e4d4b4]">목소리</h2>
          <p className="text-sm text-[#b4c4a4] mt-1">
            동화책 낭독에 쓰이는 보이스 클론 목록이에요.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors shrink-0"
        >
          + 목소리 추가
        </button>
      </header>

      {tts.length === 0 ? (
        <p className="text-sm text-[#6a5a44] italic px-1 py-4">
          아직 TTS 가 준비된 목소리가 없어요.
        </p>
      ) : (
        <ul className="space-y-3">
          {tts.map((profile) => (
            <VoiceProfileCard
              key={profile.id}
              profile={profile}
              onEdit={onEditClick}
              onDelete={onDeleteClick}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function VoiceProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: VoiceProfile
  onEdit: (p: VoiceProfile) => void
  onDelete: (p: VoiceProfile) => void
}) {
  // TTS 목록 전용이므로 previewUrl 은 항상 ttsVoiceUrl 우선. (없으면 상위 필터에서 이미 배제)
  const previewUrl = profile.ttsVoiceUrl ?? profile.audioUrl
  const [failed, setFailed] = useState(false)

  return (
    <li className="rounded-xl bg-[#1a0f08] border border-[#4a3a24] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#3ca55c]/20 border border-[#3ca55c] text-[#3ca55c] text-lg flex items-center justify-center shrink-0">
          🎙️
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#e4d4b4] font-medium truncate">{profile.title}</p>
          <p className="text-xs text-[#b4c4a4] truncate">TTS 준비 완료</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(profile)}
            className="px-2 py-1 rounded-md text-xs text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors"
          >
            편집
          </button>
          <button
            type="button"
            onClick={() => onDelete(profile)}
            className="px-2 py-1 rounded-md text-xs text-[#e85c5c] hover:bg-[#e85c5c] hover:text-[#1a0f08] transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 오디오 플레이어 — mock URL 이어도 컨트롤 UI 는 항상 렌더. */}
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
          ※ mock 파일이라 실제 재생은 안 돼요. API 연동 후 정상 재생됩니다.
        </p>
      )}
    </li>
  )
}
