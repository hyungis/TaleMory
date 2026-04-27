import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Person } from '../../entities/person'
import type { UserProfile } from '../../entities/user'
import { clearAuthSession, setAuthSession, useAuthSession } from '../../features/auth'
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

type Modal =
  | { kind: 'none' }
  | { kind: 'profile-edit' }
  | { kind: 'withdraw' }
  | { kind: 'person-edit'; person?: Person }

export function MypagePage() {
  const navigate = useNavigate()
  const authSession = useAuthSession()
  const meQuery = useMeQuery(authSession.isAuthenticated)
  const meUpdate = useMeUpdate()

  const currentUser = meQuery.data ?? authSession.user
  const currentUserId = currentUser?.id ?? 0

  const personsQuery = usePersonsQuery(currentUserId)
  const personPost = usePersonPost(currentUserId)
  const personUpdate = usePersonUpdate(currentUserId)
  const personDelete = usePersonDelete(currentUserId)

  const voiceProfilesQuery = useVoiceProfilesQuery(authSession.isAuthenticated)
  const voiceProfileDelete = useVoiceProfileDelete()
  const withdraw = useWithdraw()

  const [modal, setModal] = useState<Modal>({ kind: 'none' })

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

  if (!authSession.isAuthenticated) {
    return (
      <div className="h-full overflow-y-auto bg-[#1a0f08]">
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-16">
          <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-8 text-center space-y-3">
            <h1 className="text-2xl font-bold text-[#e4d4b4]">로그인이 필요한 페이지예요</h1>
            <p className="text-sm text-[#b4c4a4]">
              마이페이지는 로그인한 사용자만 확인할 수 있어요.
            </p>
            <Link
              to={ROUTES.home}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors"
            >
              홈으로 이동
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const goToForest = () => {
    // `/main` 이 라우트로 분리되어 있어 그대로 ForestScene(house.png) 으로 진입.
    // replace: true 로 `/mypage` 를 히스토리에서 치워 브라우저 뒤로가기가 마이페이지로
    // 다시 빨려 들어가지 않도록 한다.
    navigate(ROUTES.main, { replace: true })
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
          birthDate: draft.birthDate,
          gender: mapGenderToApi(draft.gender),
        },
      })
    } else {
      await personPost.mutateAsync({
        name: draft.name,
        birthDate: draft.birthDate ?? '',
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
    await withdraw.mutateAsync()
    clearAuthSession()
    closeModal()
    navigate(ROUTES.home, { replace: true })
  }

  return (
    <>
      <div className="h-full overflow-y-auto bg-[#1a0f08] [animation:mypageEntry_0.45s_ease-out_forwards]">
        <header className="h-14 px-6 bg-[#2a1b12] border-b border-[#4a3a24] flex items-center justify-between sticky top-0 z-50">
          <button
            type="button"
            onClick={goToForest}
            className="flex items-center gap-2 text-[#b4c4a4] hover:text-[#e4d4b4] transition-colors text-sm font-medium"
          >
            <span>{'<'}</span>
            <span>홈으로</span>
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

          {pageError && (
            <div className="bg-[#8b3a2a]/15 border border-[#8b3a2a]/40 text-[#f0e6c0] text-sm px-4 py-3 rounded-xl">
              {pageError}
            </div>
          )}

          {currentUser ? (
            <ProfileSection
              user={currentUser}
              onEditClick={() => setModal({ kind: 'profile-edit' })}
            />
          ) : (
            <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8">
              <p className="text-sm text-[#b4c4a4]">내 정보를 불러오는 중이에요.</p>
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

          <DangerZone onWithdrawClick={() => setModal({ kind: 'withdraw' })} />
        </main>
      </div>

      {modal.kind === 'profile-edit' && currentUser && (
        <ProfileEditModal user={currentUser} onClose={closeModal} onSave={handleProfileSave} />
      )}
      {modal.kind === 'withdraw' && (
        <WithdrawDialog onClose={closeModal} onConfirm={handleWithdrawConfirm} />
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
