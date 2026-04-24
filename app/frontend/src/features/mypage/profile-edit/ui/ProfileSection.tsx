import type { UserProfile } from '../../../../entities/user'

interface Props {
  user: UserProfile
  onEditClick: () => void
}

/**
 * 프로필 섹션.
 * 아바타(이니셜), 기본 정보, 편집 버튼 제공.
 * (탈퇴 버튼은 오발 방지를 위해 페이지 최하단 위험 영역으로 분리.)
 */
export function ProfileSection({ user, onEditClick }: Props) {
  const initial = user.name.charAt(0) || user.nickname.charAt(0) || '?'

  return (
    <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* 아바타(이니셜) */}
        <div
          className="w-20 h-20 rounded-full bg-[#3ca55c] text-[#1a0f08] text-3xl font-bold flex items-center justify-center shrink-0"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
          aria-label="프로필 아바타"
        >
          {initial}
        </div>

        {/* 기본 정보 */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-[#e4d4b4] truncate">{user.name}</h2>
            <span className="text-sm text-[#b4c4a4]">@{user.nickname}</span>
          </div>
          <p className="text-sm text-[#b4c4a4] truncate">{user.email}</p>
          {user.phone && <p className="text-sm text-[#b4c4a4]">{user.phone}</p>}
          <div className="flex gap-2 pt-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full border ${
                user.agreeSms
                  ? 'border-[#3ca55c] text-[#3ca55c]'
                  : 'border-[#4a3a24] text-[#6a5a44]'
              }`}
            >
              SMS {user.agreeSms ? '수신' : '차단'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border ${
                user.agreeMarketing
                  ? 'border-[#3ca55c] text-[#3ca55c]'
                  : 'border-[#4a3a24] text-[#6a5a44]'
              }`}
            >
              마케팅 {user.agreeMarketing ? '수신' : '차단'}
            </span>
            {user.provider && (
              <span className="px-2 py-0.5 rounded-full border border-[#4a3a24] text-[#b4c4a4] uppercase">
                {user.provider}
              </span>
            )}
          </div>
        </div>

        {/* 액션 */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onEditClick}
            className="px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors"
          >
            프로필 편집
          </button>
        </div>
      </div>
    </section>
  )
}
