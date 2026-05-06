import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Person } from '../../entities/person'
import type { UserProfile } from '../../entities/user'
import { buildOauthLogoutUrl, clearAuthSession, setAuthSession, useAuthSession, useLogout } from '../../features/auth'
import { BookshelfDoodles } from '../../features/bookshelf'
import {
  DangerZone,
  PersonEditModal,
  PersonsSection,
  ProfileEditModal,
  ProfileSection,
  VoiceProfilesSection,
  WithdrawDialog,
  useMeQuery,
  useMeUpdate,
  usePersonDelete,
  usePersonPost,
  usePersonsQuery,
  usePersonUpdate,
  useVoiceProfileDelete,
  useVoiceProfilesQuery,
  useWithdraw,
} from '../../features/mypage'
import { isApiError } from '../../shared/api'
import { ROUTES } from '../../shared/constants'
import './styles/mypage.css'

type Modal =
  | { kind: 'none' }
  | { kind: 'profile-edit' }
  | { kind: 'withdraw' }
  | { kind: 'person-edit'; person?: Person }

export function MypagePage() {
  const navigate = useNavigate()
  const location = useLocation()
  // 진입 시 TopRightMenu 가 state.from = 'main' | 'bookshelf' 로 기록.
  // 모르면 (직접 URL 진입 등) 'bookshelf' 로 fallback — 기존 동작 유지.
  const fromState = (location.state as { from?: 'main' | 'bookshelf' } | null)?.from
  const enteredFrom: 'main' | 'bookshelf' = fromState ?? 'bookshelf'
  const authSession = useAuthSession()
  const meQuery = useMeQuery(authSession.isAuthenticated)
  const meUpdate = useMeUpdate()
  const { isPending: isLoggingOut, logout } = useLogout()
  const hasMissingUserError = isMissingUserError(meQuery.error)

  const handleLogoutClick = () => {
    void logout().catch(() => {
      window.alert('로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.')
    })
  }

  useEffect(() => {
    if (!hasMissingUserError) return
    clearAuthSession()
  }, [hasMissingUserError])

  const currentUser = hasMissingUserError ? null : (meQuery.data ?? authSession.user)
  const currentUserId = currentUser?.id ?? 0

  const personsQuery = usePersonsQuery(currentUserId)
  const personPost = usePersonPost(currentUserId)
  const personUpdate = usePersonUpdate(currentUserId)
  const personDelete = usePersonDelete(currentUserId)

  const [modal, setModal] = useState<Modal>({ kind: 'none' })
  const voiceProfilesQuery = useVoiceProfilesQuery(authSession.isAuthenticated)
  const voiceProfileDelete = useVoiceProfileDelete()
  const withdraw = useWithdraw()

  const closeModal = () => setModal({ kind: 'none' })

  const pageError = getFirstErrorMessage(
    meQuery.error,
    personsQuery.error,
    voiceProfilesQuery.error,
    meUpdate.error,
    personPost.error,
    personUpdate.error,
    personDelete.error,
    voiceProfileDelete.error,
    withdraw.error,
  )

  // 로그아웃 진행 중에는 "로그인 필요" 분기로 들어가지 않고 빈 캔버스를 유지.
  // useLogout 이 clearAuthSession 직후 isAuthenticated 를 false 로 만들기 때문에
  // 가드 없이 두면 alert + window.location.assign 사이에 "로그인이 필요한 페이지" 가
  // 한 프레임 깜빡이며 노출되는 문제 방지.
  if (isLoggingOut) {
    return <div className="mypage-shell" aria-hidden="true" />
  }

  if (!authSession.isAuthenticated || hasMissingUserError) {
    return (
      <div className="mypage-shell">
        <div className="mp-doodles-bg" aria-hidden="true">
          <BookshelfDoodles />
        </div>
        <main className="mp-auth-required">
          <section className="mp-auth-required-card">
            <h1>로그인이 필요해요</h1>
            <p>마이페이지는 로그인한 사용자만 확인할 수 있어요.</p>
            <Link to={ROUTES.home}>홈으로 이동</Link>
          </section>
        </main>
      </div>
    )
  }

  const handleBack = () => {
    // 진입 발화 지점에 따라 분기:
    //  - main(ForestScene) 에서 햄버거로 들어왔으면 → /main 으로 복귀 (숲 씬)
    //  - bookshelf(BookstoreScene) 에서 들어왔으면 → /main/bookshelf 로 복귀 (책장 모달)
    // replace: true 로 `/mypage` 를 히스토리에서 치워 브라우저 뒤로가기가 마이페이지로
    // 다시 빨려 들어가지 않도록 한다.
    const target = enteredFrom === 'main' ? ROUTES.main : ROUTES.mainBookshelf
    navigate(target, { replace: true })
  }

  const handleProfileSave = async (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone'>) => {
    const nextUser = await meUpdate.mutateAsync({
      ...patch,
      phone: patch.phone ?? null,
    })

    if (authSession.accessToken) {
      setAuthSession({
        accessToken: authSession.accessToken,
        user: nextUser,
      })
    }

    closeModal()
  }

  const handlePersonSave = async (draft: Omit<Person, 'id' | 'userId'>) => {
    if (modal.kind !== 'person-edit' || currentUserId <= 0) return

    if (modal.person) {
      await personUpdate.mutateAsync({
        personId: modal.person.id,
        body: {
          name: draft.name,
          age: draft.age,
          gender: mapGenderToApi(draft.gender),
        },
      })
    } else {
      await personPost.mutateAsync({
        name: draft.name,
        age: draft.age,
        gender: mapGenderToApi(draft.gender),
        role: 'CHILD',
      })
    }

    closeModal()
  }

  const handlePersonDelete = async (person: Person) => {
    if (!window.confirm(`"${person.name}" 주인공 정보를 삭제할까요?`)) return
    await personDelete.mutateAsync(person.id)
  }

  const handleVoiceDelete = async (voiceProfileId: number, title: string) => {
    if (!window.confirm(`"${title}" 목소리를 삭제할까요?`)) return
    await voiceProfileDelete.mutateAsync(voiceProfileId)
  }

  const handleWithdrawConfirm = async () => {
    const provider = currentUser?.provider ?? authSession.user?.provider ?? null

    try {
      await withdraw.mutateAsync()
    } catch (error) {
      if (!isMissingUserError(error)) {
        throw error
      }
    }

    clearAuthSession()
    closeModal()

    const oauthLogoutUrl = buildOauthLogoutUrl(provider, window.location.origin)
    if (oauthLogoutUrl) {
      window.location.assign(oauthLogoutUrl)
      return
    }

    navigate(ROUTES.home, { replace: true })
  }

  return (
    <>
      <div className="mypage-shell" style={{ animation: 'mpFadeIn 0.45s ease-out' }}>
        <div className="mp-doodles-bg" aria-hidden="true">
          <BookshelfDoodles />
        </div>

        <header className="mp-nav">
          <button
            type="button"
            onClick={handleBack}
            className="mp-back-btn"
            aria-label={enteredFrom === 'main' ? '메인으로 돌아가기' : '책장으로 돌아가기'}
          >
            <span aria-hidden="true">{'←'}</span>
            <span>돌아가기</span>
          </button>
          <Link to={ROUTES.home} className="mp-logo">
            Tale<span className="accent">Mory</span>
          </Link>
        </header>

        <main className="mp-content">
          <h1 className="mp-page-title">마이페이지</h1>
          <svg
            className="mp-page-title-underline"
            viewBox="0 0 200 6"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M2,3 Q40,0 80,3 T160,3 T198,3"
              stroke="#c47254"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          {pageError && <div className="mp-page-error">{pageError}</div>}

          {currentUser ? (
            <ProfileSection
              user={currentUser}
              onEditClick={() => setModal({ kind: 'profile-edit' })}
            />
          ) : (
            <section className="mp-loading-card">
              <span className="mp-tape" aria-hidden="true" />
              내 정보를 불러오는 중이에요.
            </section>
          )}

          <PersonsSection
            persons={personsQuery.data ?? []}
            onAddClick={() => setModal({ kind: 'person-edit' })}
            onEditClick={person => setModal({ kind: 'person-edit', person })}
            onDeleteClick={handlePersonDelete}
            isLoading={personsQuery.isPending}
            isBusy={personPost.isPending || personUpdate.isPending || personDelete.isPending}
          />

          <VoiceProfilesSection
            voiceProfiles={voiceProfilesQuery.data ?? []}
            onAddClick={() => navigate(ROUTES.mypageVoiceClone)}
            onDeleteClick={profile => handleVoiceDelete(profile.id, profile.title)}
            isLoading={voiceProfilesQuery.isPending}
            isBusy={voiceProfileDelete.isPending}
          />

          <DangerZone
            onWithdrawClick={() => setModal({ kind: 'withdraw' })}
            onLogoutClick={handleLogoutClick}
            isLoggingOut={isLoggingOut}
          />
        </main>
      </div>

      {modal.kind === 'profile-edit' && currentUser && (
        <ProfileEditModal
          user={currentUser}
          onClose={closeModal}
          onSave={handleProfileSave}
          isPending={meUpdate.isPending}
        />
      )}
      {modal.kind === 'withdraw' && (
        <WithdrawDialog
          onClose={closeModal}
          onConfirm={handleWithdrawConfirm}
          isPending={withdraw.isPending}
        />
      )}
      {modal.kind === 'person-edit' && (
        <PersonEditModal initial={modal.person} onClose={closeModal} onSave={handlePersonSave} />
      )}
    </>
  )
}

function mapGenderToApi(gender: Person['gender']): 'MALE' | 'FEMALE' | 'OTHER' {
  switch (gender) {
    case 'male':
      return 'MALE'
    case 'female':
      return 'FEMALE'
    default:
      return 'OTHER'
  }
}

function getFirstErrorMessage(...errors: Array<unknown>): string | null {
  for (const error of errors) {
    if (error == null) continue

    if (isApiError(error)) {
      return error.message
    }

    if (error instanceof Error) {
      return error.message
    }
  }

  return null
}

function isMissingUserError(error: unknown): boolean {
  return isApiError(error) && error.status === 404 && error.code === 'USER_001'
}
