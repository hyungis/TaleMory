import type { UserProfile } from '../../../../entities/user'

interface Props {
  user: UserProfile
  onEditClick: () => void
}

/**
 * 프로필 섹션 — paper-craft 톤.
 * 아바타(이니셜), 기본 정보, 편집 버튼.
 * (탈퇴 버튼은 오발 방지를 위해 페이지 최하단 위험 영역으로 분리.)
 */
export function ProfileSection({ user, onEditClick }: Props) {
  const initial = user.name.charAt(0) || user.nickname.charAt(0) || '?'

  return (
    <section className="mp-card">
      <span className="mp-tape" aria-hidden="true" />
      <div className="mp-profile-row">
        {/* 아바타(이니셜) */}
        <div className="mp-avatar" aria-label="프로필 아바타">
          {initial}
        </div>

        {/* 기본 정보 */}
        <div className="mp-profile-info">
          <span className="mp-lbl">닉네임</span>
          <span className="mp-val">{user.nickname}</span>
          <span className="mp-lbl">이름</span>
          <span className="mp-val">{user.name}</span>
          <span className="mp-lbl">이메일</span>
          <span className="mp-val">{user.email}</span>
          {user.phone && (
            <>
              <span className="mp-lbl">전화</span>
              <span className="mp-val">{user.phone}</span>
            </>
          )}
          <div className="mp-profile-tags">
            <span className={`mp-tag-chip${user.agreeSms ? '' : ' mp-tag-chip--off'}`}>
              {user.agreeSms ? '✓' : '✕'} SMS {user.agreeSms ? '수신' : '차단'}
            </span>
            <span className={`mp-tag-chip${user.agreeMarketing ? '' : ' mp-tag-chip--off'}`}>
              {user.agreeMarketing ? '✓' : '✕'} 마케팅 {user.agreeMarketing ? '수신' : '차단'}
            </span>
            {user.provider && (
              <span className="mp-tag-chip mp-tag-chip--provider">{user.provider}</span>
            )}
          </div>
        </div>

        {/* 편집 CTA */}
        <button type="button" onClick={onEditClick} className="mp-btn mp-btn-sage">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M11,2 L14,5 L5,14 L2,14 L2,11 Z"
              stroke="#fdf6dc"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          프로필 편집
        </button>
      </div>
    </section>
  )
}
