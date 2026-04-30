import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Person } from '../../entities/person'
import type { UserProfile } from '../../entities/user'
import { buildOauthLogoutUrl, clearAuthSession, setAuthSession, useAuthSession, useLogout } from '../../features/auth'
import {
  DangerZone,
  PersonEditModal,
  PersonsSection,
  ProfileEditModal,
  ProfileSection,
  VoiceProfileDetailsModal,
  VoiceProfilesSection,
  WithdrawDialog,
  useMeQuery,
  useMeUpdate,
  usePersonDelete,
  usePersonPost,
  usePersonsQuery,
  usePersonUpdate,
  useVoiceProfileDelete,
  useVoiceProfileQuery,
  useVoiceProfilesQuery,
  useWithdraw,
} from '../../features/mypage'
import { isApiError } from '../../shared/api'
import { ROUTES } from '../../shared/constants'

type Modal =
  | { kind: 'none' }
  | { kind: 'profile-edit' }
  | { kind: 'withdraw' }
  | { kind: 'person-edit'; person?: Person }
  | { kind: 'voice-detail'; voiceProfileId: number }

export function MypagePage() {
  const navigate = useNavigate()
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
  const selectedVoiceProfileId = modal.kind === 'voice-detail' ? modal.voiceProfileId : null
  const voiceProfileQuery = useVoiceProfileQuery(selectedVoiceProfileId, authSession.isAuthenticated)
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
    return <div className="h-full bg-[#F4E4BC]" aria-hidden="true" />
  }

  if (!authSession.isAuthenticated || hasMissingUserError) {
    return (
      <div className="h-full overflow-y-auto bg-[#F4E4BC]">
        <main className="max-w-3xl mx-auto px-6 md:px-8 py-16">
          <section className="rounded-3xl bg-[#E9DBBE] border-2 border-[#B9D38F]/55 shadow-[0_4px_14px_rgba(154,117,72,0.14)] p-8 text-center space-y-4">
            <h1 className="text-2xl font-bold text-[#3E2A18]">로그인이 필요한 페이지예요</h1>
            <p className="text-sm text-[#6B4A28]">
              마이페이지는 로그인한 사용자만 확인할 수 있어요.
            </p>
            <Link
              to={ROUTES.home}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#8DBA64] text-[#1F3318] text-sm font-bold border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all"
            >
              홈으로 이동
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const goToBookshelf = () => {
    // 마이페이지는 BookstoreScene(=BookshelfModal) 안의 in-world 버튼에서 진입한다.
    // 따라서 복귀도 ForestScene 재생 없이 곧장 책장 씬으로 들어가야 한다.
    // `/main/bookshelf` 라우트로 직행하면 MainPage 의 `isBookshelfOpen` 이 true 로 마운트되어
    // 책장 모달이 첫 프레임부터 열린 상태가 된다 (CreationPage.goToBookshelf 패턴과 동일).
    // replace: true 로 `/mypage` 를 히스토리에서 치워 브라우저 뒤로가기가 마이페이지로
    // 다시 빨려 들어가지 않도록 한다.
    navigate(ROUTES.mainBookshelf, { replace: true })
  }

  const handleProfileSave = async (
    patch: Pick<UserProfile, 'name' | 'nickname' | 'phone' | 'agreeSms' | 'agreeMarketing'>,
  ) => {
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
      <div className="h-full overflow-y-auto bg-[#F4E4BC] [animation:mypageEntry_0.45s_ease-out_forwards]">
        <header className="h-14 px-6 bg-[#E9DBBE] border-b-2 border-[#9A7548]/30 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <button
            type="button"
            onClick={goToBookshelf}
            className="flex items-center gap-1.5 bg-[#F4E4BC] text-[#3E2A18] px-4 py-1.5 rounded-full border-2 border-[#9A7548]/40 hover:bg-[#D9BE82] transition-colors font-bold text-sm"
            aria-label="책장으로 돌아가기"
          >
            <span aria-hidden="true">{'←'}</span>
            <span>돌아가기</span>
          </button>
          <Link
            to={ROUTES.home}
            className="text-[#3F6B2E] text-2xl font-bold tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            TaleMory
          </Link>
        </header>

        <main className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 py-10 space-y-6 pb-16">
          <h1
            className="text-3xl md:text-4xl font-bold text-[#3E2A18]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
          >
            마이페이지
          </h1>

          {pageError && (
            <div className="bg-[#F4E4BC] border-2 border-[#a3413f]/40 text-[#a3413f] text-sm px-4 py-3 rounded-xl font-bold">
              {pageError}
            </div>
          )}

          {currentUser ? (
            <ProfileSection
              user={currentUser}
              onEditClick={() => setModal({ kind: 'profile-edit' })}
            />
          ) : (
            <section className="rounded-3xl bg-[#E9DBBE] border-2 border-[#B9D38F]/55 shadow-[0_4px_14px_rgba(154,117,72,0.14)] p-6 md:p-8">
              <p className="text-sm text-[#6B4A28]">내 정보를 불러오는 중이에요.</p>
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
            onDetailsClick={profile => setModal({ kind: 'voice-detail', voiceProfileId: profile.id })}
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
      {modal.kind === 'voice-detail' && (
        <VoiceProfileDetailsModal
          profile={voiceProfileQuery.data}
          isLoading={voiceProfileQuery.isPending}
          errorMessage={getFirstErrorMessage(voiceProfileQuery.error)}
          onClose={closeModal}
        />
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
