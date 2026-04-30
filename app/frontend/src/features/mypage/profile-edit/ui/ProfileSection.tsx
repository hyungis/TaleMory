import type { UserProfile } from '../../../../entities/user'

interface Props {
  user: UserProfile
  onEditClick: () => void
}

/**
 * 프로필 섹션 — Pastel Forest 톤.
 * 아바타(이니셜), 기본 정보, 편집 버튼.
 * (탈퇴 버튼은 오발 방지를 위해 페이지 최하단 위험 영역으로 분리.)
 */
export function ProfileSection({ user, onEditClick }: Props) {
  const initial = user.name.charAt(0) || user.nickname.charAt(0) || '?'

  return (
    <section className="rounded-3xl bg-[#E9DBBE] border-2 border-[#B9D38F]/55 shadow-[0_4px_14px_rgba(154,117,72,0.14)] p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* 아바타(이니셜) — sage 톤 원형 */}
        <div
          className="w-20 h-20 rounded-full bg-[#3F6B2E] text-[#FFFEF8] text-3xl font-bold flex items-center justify-center shrink-0 border-2 border-[#B9D38F] shadow-[0_3px_0_#1F3318]"
          aria-label="프로필 아바타"
        >
          {initial}
        </div>

        {/* 기본 정보 — 라벨: 값 형태로 분리. */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline gap-2 text-base">
            <span className="text-[#9A7548] font-bold w-14 shrink-0">닉네임</span>
            <span className="text-[#3E2A18] font-bold truncate">{user.nickname}</span>
          </div>
          <div className="flex items-baseline gap-2 text-base">
            <span className="text-[#9A7548] font-bold w-14 shrink-0">이름</span>
            <span className="text-[#3E2A18] font-bold truncate">{user.name}</span>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-[#9A7548] font-bold w-14 shrink-0">이메일</span>
            <span className="text-[#6B4A28] truncate">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-[#9A7548] font-bold w-14 shrink-0">전화</span>
              <span className="text-[#6B4A28] truncate">{user.phone}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2 text-xs flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full border font-bold ${
                user.agreeSms
                  ? 'border-[#3F6B2E]/50 bg-[#B9D38F]/40 text-[#3F6B2E]'
                  : 'border-[#9A7548]/30 bg-[#F4E4BC]/60 text-[#9A7548]'
              }`}
            >
              SMS {user.agreeSms ? '수신' : '차단'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full border font-bold ${
                user.agreeMarketing
                  ? 'border-[#3F6B2E]/50 bg-[#B9D38F]/40 text-[#3F6B2E]'
                  : 'border-[#9A7548]/30 bg-[#F4E4BC]/60 text-[#9A7548]'
              }`}
            >
              마케팅 {user.agreeMarketing ? '수신' : '차단'}
            </span>
            {user.provider && (
              <span className="px-2.5 py-0.5 rounded-full border border-[#9A7548]/40 bg-[#F4E4BC]/60 text-[#6B4A28] uppercase font-bold">
                {user.provider}
              </span>
            )}
          </div>
        </div>

        {/* 액션 — sage primary CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onEditClick}
            className="px-5 py-2.5 rounded-full bg-[#8DBA64] text-[#1F3318] text-sm font-bold border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all"
          >
            프로필 편집
          </button>
        </div>
      </div>
    </section>
  )
}
