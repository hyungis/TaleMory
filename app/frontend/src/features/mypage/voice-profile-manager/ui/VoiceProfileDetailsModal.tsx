import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  profile?: VoiceProfile
  isLoading?: boolean
  errorMessage?: string | null
  onClose: () => void
}

/**
 * 목소리 상세 모달 — paper-craft 톤.
 */
export function VoiceProfileDetailsModal({
  profile,
  isLoading = false,
  errorMessage = null,
  onClose,
}: Props) {
  const previewUrl = profile?.ttsVoiceUrl ?? profile?.audioUrl

  return (
    <div className="mp-modal-back" onClick={onClose} role="presentation">
      <section
        className="mp-modal"
        onClick={event => event.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ marginBottom: 4 }}>목소리 상세</h3>
            <p
              style={{
                fontFamily: 'Gaegu, cursive',
                fontSize: 15,
                color: '#6b5638',
                margin: 0,
              }}
            >
              저장된 보이스 프로필 정보를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mp-icon-action"
            style={{ padding: '6px 12px' }}
          >
            닫기
          </button>
        </div>

        {isLoading ? (
          <p className="mp-muted">목소리 정보를 불러오는 중이에요.</p>
        ) : errorMessage ? (
          <p
            style={{
              borderRadius: 12,
              border: '1.5px solid rgba(196, 114, 84, 0.45)',
              background: 'rgba(196, 114, 84, 0.12)',
              padding: '10px 14px',
              color: '#8c3a1f',
              fontFamily: 'Gaegu, cursive',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {errorMessage}
          </p>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                columnGap: 16,
                rowGap: 10,
                margin: 0,
                fontFamily: 'Gaegu, cursive',
                fontSize: 16,
              }}
            >
              <dt style={{ color: '#6b5638', fontWeight: 700 }}>이름</dt>
              <dd style={{ color: '#4a3b2a', fontWeight: 700, margin: 0 }}>{profile.title}</dd>
              <dt style={{ color: '#6b5638', fontWeight: 700 }}>프로필 ID</dt>
              <dd style={{ color: '#4a3b2a', fontWeight: 700, margin: 0 }}>{profile.id}</dd>
              <dt style={{ color: '#6b5638', fontWeight: 700 }}>저장일</dt>
              <dd style={{ color: '#4a3b2a', fontWeight: 700, margin: 0 }}>
                {formatDateTime(profile.createdAt)}
              </dd>
              <dt style={{ color: '#6b5638', fontWeight: 700 }}>수정일</dt>
              <dd style={{ color: '#4a3b2a', fontWeight: 700, margin: 0 }}>
                {formatDateTime(profile.updatedAt)}
              </dd>
            </dl>

            {previewUrl ? (
              <audio controls src={previewUrl} preload="none" style={{ width: '100%' }} />
            ) : (
              <p
                style={{
                  fontFamily: 'Gaegu, cursive',
                  fontSize: 14,
                  color: '#a37548',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                아직 재생 가능한 오디오가 연결되지 않았어요.
              </p>
            )}
          </div>
        ) : (
          <p className="mp-muted">목소리 정보를 찾을 수 없어요.</p>
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
