import { useEffect, useState } from 'react'
import { FolderOpen, Loader2, X } from 'lucide-react'
import type { VoiceProfileDto } from '../api/voiceProfileApi'
import type { VoiceProfileId } from '../../../../shared/types'

interface VoiceLoadModalProps {
  /** hook 의 fetchVoiceProfiles — 모달 열릴 때 한 번 호출. */
  fetchProfiles: () => Promise<VoiceProfileDto[]>
  /** 선택된 프로필을 hook 의 loadVoiceProfile 로 넘김. 호출부가 onClose 까지 책임. */
  onSelect: (profile: VoiceProfileDto) => void | Promise<void>
  onClose: () => void
}

/**
 * 보이스 클론 — "기존 음성 불러오기" 모달.
 *
 * 모달 열릴 때 BE `/voice-profiles` 를 한 번 fetch → 사용자에게 제목 + 생성일 리스트 표시.
 * row 클릭 시 onSelect 호출. 빈 리스트 / 로딩 / 에러 상태를 모두 인라인으로 표시.
 */
export function VoiceLoadModal({ fetchProfiles, onSelect, onClose }: VoiceLoadModalProps) {
  const [profiles, setProfiles] = useState<VoiceProfileDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState<VoiceProfileId | null>(null)

  // 모달 열릴 때 1회 fetch.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchProfiles()
      .then(list => {
        if (!cancelled) {
          setProfiles(list)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '저장된 음성을 불러오지 못했습니다.'
          setError(msg)
          setProfiles([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchProfiles])

  // ESC 닫기 — pendingId 동안에는 attach race 방지 위해 무시.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingId === null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pendingId])

  const handleSelect = async (profile: VoiceProfileDto) => {
    if (pendingId !== null) return
    setPendingId(profile.voiceProfileId)
    try {
      await onSelect(profile)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-load-modal-title"
      onClick={() => {
        if (pendingId === null) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45, 30, 20, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fdf6dc',
          border: '2.5px solid var(--cr-caramel)',
          borderRadius: 18,
          padding: '22px 24px 18px',
          boxShadow: '0 8px 24px rgba(80, 50, 30, 0.25), 0 4px 0 var(--cr-caramel)',
          fontFamily: 'var(--cr-font-gaegu)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--cr-sage-darker)',
                color: '#fdf6dc',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <FolderOpen className="w-4 h-4" />
            </span>
            <h3
              id="voice-load-modal-title"
              style={{
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--cr-ink)',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              저장된 음성 불러오기
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pendingId !== null}
            aria-label="모달 닫기"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cr-ink-soft)',
              cursor: pendingId !== null ? 'not-allowed' : 'pointer',
              opacity: pendingId !== null ? 0.4 : 1,
              padding: 4,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '2px solid var(--cr-caramel)',
            borderRadius: 14,
            padding: 6,
            background: '#fbf2da',
          }}
        >
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '24px 12px',
                color: 'var(--cr-ink-soft)',
                fontSize: 17,
              }}
            >
              <Loader2 className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
              <span>저장된 음성을 불러오는 중…</span>
            </div>
          )}
          {!loading && error && (
            <div
              style={{
                padding: '20px 12px',
                color: 'var(--cr-rust)',
                fontSize: 17,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && profiles && profiles.length === 0 && (
            <div
              style={{
                padding: '24px 12px',
                color: 'var(--cr-ink-soft)',
                fontSize: 17,
                textAlign: 'center',
              }}
            >
              아직 저장된 음성이 없어요. 새로 녹음 후 저장하면 여기에 표시됩니다.
            </div>
          )}
          {!loading && !error && profiles && profiles.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {profiles.map(profile => {
                const isPending = pendingId === profile.voiceProfileId
                const isOtherPending = pendingId !== null && !isPending
                const created = new Date(profile.createdAt)
                const createdLabel = Number.isNaN(created.getTime())
                  ? profile.createdAt
                  : created.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                return (
                  <li key={profile.voiceProfileId}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(profile)}
                      disabled={isOtherPending}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: isPending ? 'var(--cr-sage)' : '#fdf6dc',
                        border: '2px solid var(--cr-caramel)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        cursor: isOtherPending ? 'not-allowed' : 'pointer',
                        opacity: isOtherPending ? 0.5 : 1,
                        fontFamily: 'var(--cr-font-gaegu)',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--cr-ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {profile.title || '(제목 없음)'}
                        </span>
                        <span style={{ fontSize: 14, color: 'var(--cr-ink-soft)' }}>
                          {createdLabel}
                        </span>
                      </div>
                      {isPending ? (
                        <Loader2
                          className="w-4 h-4"
                          style={{
                            animation: 'spin 1s linear infinite',
                            color: 'var(--cr-ink)',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 15,
                            color: 'var(--cr-sage-deep)',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          선택 →
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 14,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={pendingId !== null}
            className="cr-btn-back"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
