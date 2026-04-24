import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ROUTES } from '../../shared/constants'
import type { UserProfile } from '../../entities/user'
import type { Person } from '../../entities/person'
import type { VoiceProfile } from '../../entities/voice-profile'
import { ProfileSection } from './ui/ProfileSection'
import { ProfileEditModal } from './ui/ProfileEditModal'
import { WithdrawDialog } from './ui/WithdrawDialog'
import { PersonsSection } from './ui/PersonsSection'
import { PersonEditModal } from './ui/PersonEditModal'
import { VoiceProfilesSection } from './ui/VoiceProfilesSection'
import { VoiceProfileEditModal } from './ui/VoiceProfileEditModal'
import { DangerZone } from './ui/DangerZone'
import { mockPersons, mockUser, mockVoiceProfiles } from './model/mockData'

/**
 * 마이페이지 — 세로 스크롤 섹션 구성.
 * 섹션: 프로필 / 인물 / 보이스 프로필.
 *
 * 현재는 모든 CRUD 가 로컬 state 뿐 (mockData 기반). API 연동은 별도 PR 에서.
 * TODO(api):
 *   - GET/PATCH/DELETE /api/me → useMe 훅
 *   - GET/POST/PATCH/DELETE /api/persons → usePersons
 *   - GET/POST/PATCH/DELETE /api/voice-profiles → useVoiceProfiles
 *   - 탈퇴 확정 시 로그아웃 + 홈 이동
 */
export function MypagePage() {
  const navigate = useNavigate()

  /** CreationPage.goToBookshelf 패턴 재활용 — 새 MainPage 인스턴스 생성 없이 bookstore 씬으로 복귀. */
  const goToBookshelf = useCallback(() => {
    navigate(ROUTES.home, {
      state: { scene: 'bookstore', skipLanding: true },
      replace: true,
    })
  }, [navigate])

  const [user, setUser] = useState<UserProfile>(mockUser)
  const [persons, setPersons] = useState<Person[]>(mockPersons)
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>(mockVoiceProfiles)

  // 모달 토글 — 단 하나만 열리도록 단일 상태로 통일.
  // 보이스 "추가" 는 모달이 아니라 /mypage/voice-clone 전용 라우트로 이동.
  type Modal =
    | { kind: 'none' }
    | { kind: 'profile-edit' }
    | { kind: 'withdraw' }
    | { kind: 'person-edit'; person?: Person } // person 없으면 추가
    | { kind: 'voice-edit'; voice: VoiceProfile } // 편집 전용 (추가는 별도 페이지)
  const [modal, setModal] = useState<Modal>({ kind: 'none' })
  const closeModal = () => setModal({ kind: 'none' })

  // ── 프로필 핸들러 ────────────────────────────────────
  const handleProfileSave = (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone' | 'agreeSms' | 'agreeMarketing'>) => {
    setUser((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }))
    closeModal()
  }
  const handleWithdrawConfirm = () => {
    // TODO: DELETE /api/me + 로그아웃 + 홈 이동
    console.log('[mypage] withdraw confirmed (mock)')
    closeModal()
  }

  // ── 인물 핸들러 ──────────────────────────────────────
  const handlePersonSave = (draft: Omit<Person, 'id' | 'userId'>) => {
    if (modal.kind !== 'person-edit') return
    if (modal.person) {
      const id = modal.person.id
      setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, ...draft } : p)))
    } else {
      setPersons((prev) => [
        ...prev,
        { ...draft, id: Date.now(), userId: user.id } as Person,
      ])
    }
    closeModal()
  }
  const handlePersonDelete = (target: Person) => {
    if (!window.confirm(`"${target.name}" 을(를) 삭제하시겠어요?`)) return
    setPersons((prev) => prev.filter((p) => p.id !== target.id))
  }

  // ── 보이스 핸들러 ────────────────────────────────────
  // 추가(녹음)는 /mypage/voice-clone 라우트에서 처리. 여기선 제목 편집만.
  const handleVoiceSave = (draft: Pick<VoiceProfile, 'title'>) => {
    if (modal.kind !== 'voice-edit') return
    const id = modal.voice.id
    setVoiceProfiles((prev) => prev.map((v) => (v.id === id ? { ...v, ...draft } : v)))
    closeModal()
  }
  const handleVoiceDelete = (target: VoiceProfile) => {
    if (!window.confirm(`"${target.title}" 을(를) 삭제하시겠어요?`)) return
    setVoiceProfiles((prev) => prev.filter((v) => v.id !== target.id))
  }

  // #root 가 height:100% + overflow:hidden 이므로, 마이페이지 컨테이너에서
  // 자체 스크롤을 만들어야 함 (글로벌 CSS 는 숲/서점 풀스크린 씬 때문에 유지).
  // 모달은 애니메이션 div 밖(형제)에 렌더링.
  // 이유: CSS transform(animation forwards)이 걸린 조상은 position:fixed 의
  // containing block 이 되어, 모달이 스크롤에 따라 잘리는 버그가 발생함.
  return (
    <>
      <div className="h-full overflow-y-auto bg-[#1a0f08] [animation:mypageEntry_0.45s_ease-out_forwards]">
        {/* 마이페이지 전용 헤더 — ← 돌아가기로 bookstore 씬 복귀 (skipLanding + replace) */}
        <header className="h-14 px-6 bg-[#2a1b12] border-b border-[#4a3a24] flex items-center justify-between sticky top-0 z-50">
          <button
            type="button"
            onClick={goToBookshelf}
            className="flex items-center gap-2 text-[#b4c4a4] hover:text-[#e4d4b4] transition-colors text-sm font-medium"
          >
            <span>←</span>
            <span>돌아가기</span>
          </button>
          <Link
            to={ROUTES.home}
            className="text-[#3ca55c] text-xl font-bold tracking-wider"
            style={{ textShadow: '0 0 12px rgba(60, 165, 92, 0.4), 0 2px 8px rgba(0, 0, 0, 0.6)' }}
          >
            TaleMory
          </Link>
        </header>
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6 pb-16">
          <h1 className="text-2xl md:text-3xl font-bold text-[#e4d4b4]">마이페이지</h1>

          <ProfileSection
            user={user}
            onEditClick={() => setModal({ kind: 'profile-edit' })}
          />

          <PersonsSection
            persons={persons}
            onAddClick={() => setModal({ kind: 'person-edit' })}
            onEditClick={(person) => setModal({ kind: 'person-edit', person })}
            onDeleteClick={handlePersonDelete}
          />

          <VoiceProfilesSection
            voiceProfiles={voiceProfiles}
            onAddClick={() => navigate(ROUTES.mypageVoiceClone)}
            onEditClick={(voice) => setModal({ kind: 'voice-edit', voice })}
            onDeleteClick={handleVoiceDelete}
          />

          <DangerZone onWithdrawClick={() => setModal({ kind: 'withdraw' })} />
        </main>
      </div>

      {modal.kind === 'profile-edit' && (
        <ProfileEditModal user={user} onClose={closeModal} onSave={handleProfileSave} />
      )}
      {modal.kind === 'withdraw' && (
        <WithdrawDialog onClose={closeModal} onConfirm={handleWithdrawConfirm} />
      )}
      {modal.kind === 'person-edit' && (
        <PersonEditModal initial={modal.person} onClose={closeModal} onSave={handlePersonSave} />
      )}
      {modal.kind === 'voice-edit' && (
        <VoiceProfileEditModal initial={modal.voice} onClose={closeModal} onSave={handleVoiceSave} />
      )}
    </>
  )
}
