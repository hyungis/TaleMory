import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Star, Wand2 } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { isApiError } from '../../../../shared/api'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { PhotoUploadZone } from './PhotoUploadZone'
import { PhotoItem } from './PhotoItem'
import { EmptyPhotoState } from './EmptyPhotoState'
import { usePhotosQuery } from '../model/usePhotosQuery'
import { usePhotoUpload } from '../model/usePhotoUpload'
import { useDeletePhoto } from '../model/useDeletePhoto'
import { useUpdatePhoto } from '../model/useUpdatePhoto'
import { useReorderPhotos } from '../model/useReorderPhotos'
import { useCharacterRefTogglePut } from '../model/useCharacterRefTogglePut'
import { useStoryboardSummaryQuery } from '../../storyboard-prompt'
import { MAX_PHOTOS } from '../lib/constants'

/** AI schema 의 characterSourceImageS3Keys max_length 와 일치. BE 도 동일 상수. */
const MAX_CHARACTER_REFS = 3

interface PhotoManagerStepProps {
  /** BasicInfoStep 에서 POST/PATCH 후 받은 story id. null 이면 업로드 불가 상태로 fallback. */
  storyId: number | null
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 02 — 추억 사진 업로드 + 대표 사진 (캐릭터 reference) 선택.
 *
 * 두 zone:
 *  1. 추억 사진 zone — `purpose IN (STORYBOARD, BOTH)` 사진. 카드별 별 토글로 BOTH ↔ STORYBOARD.
 *  2. 대표 사진 zone — `purpose = CHARACTER_REF` 별도 업로드 사진. 가족이 모두 잘 나온 사진을 직접 올림.
 *
 * 검증:
 *  - reference 합산 (`CHARACTER_REF` + `BOTH`) 1장 이상이어야 다음 단계 진입 가능.
 *  - 합산 max 3 — AI schema 제약. BE 가 commit/toggle 시점에 거부 (FE 도 사전 차단).
 *  - 첫 STORYBOARD_IMAGE 배치 시작 후 lock — toggle / 별도 reference 업로드/삭제 거부 (BE 측 STORY_021).
 *    FE 는 사전 비활성하지 않고 BE 거부 시 toast 로 안내.
 *
 * 서버 상태 관리:
 *  - `usePhotosQuery(storyId)` — 모든 사진 (purpose 무관) — FE 가 client-side filter.
 *  - `usePhotoUpload(storyId, 'STORYBOARD')` / `usePhotoUpload(storyId, 'CHARACTER_REF')` — 두 zone 별 분리 인스턴스.
 *  - `useCharacterRefTogglePut(storyId)` — 별 토글.
 */
export function PhotoManagerStep({ storyId, onBack, onNext }: PhotoManagerStepProps) {
  const photosQuery = usePhotosQuery(storyId)
  const memoryUpload = usePhotoUpload(storyId, 'STORYBOARD')
  const refUpload = usePhotoUpload(storyId, 'CHARACTER_REF')
  const deleteMutation = useDeletePhoto(storyId)
  const updateMutation = useUpdatePhoto(storyId)
  const reorderMutation = useReorderPhotos(storyId)
  const toggleMutation = useCharacterRefTogglePut(storyId)
  const [toast, setToast] = useState<string | null>(null)

  /**
   * Step 1+2 락 — SUMMARY 잡이 PENDING/RUNNING/SUCCESS 면 모든 사진 mutation 을 막는다.
   * BE 의 `STEP_LOCKED_BY_SUMMARY` (STORY_022) 와 1:1 매칭. FAILED 만 있거나 잡 자체가 없으면 lock 해제.
   *
   * 사용자가 Step 3 진입 후 Step 2 로 회귀했을 때 사진을 바꾸면 downstream(이미지/스토리)이
   * 입력과 어긋나 깨지므로 차단. UI 는 read-only 배너 + 컨트롤 비활성으로 안내.
   */
  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const summaryStatus = summaryQuery.data?.jobStatus ?? null
  const isSummaryLocked =
    summaryStatus === 'PENDING' || summaryStatus === 'RUNNING' || summaryStatus === 'SUCCESS'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const allPhotos = photosQuery.data ?? []
  // 추억 zone: STORYBOARD + BOTH (별 채워지는 건 BOTH).
  const memoryPhotos = allPhotos.filter(p => p.purpose === 'STORYBOARD' || p.purpose === 'BOTH')
  // 대표 별도 업로드 zone: CHARACTER_REF only.
  const refOnlyPhotos = allPhotos.filter(p => p.purpose === 'CHARACTER_REF')
  // 대표 합산 (별 토글된 BOTH + 별도 업로드 CHARACTER_REF) — Next 가드 + 카운터 표시.
  const refCount = allPhotos.filter(p => p.purpose === 'BOTH' || p.purpose === 'CHARACTER_REF').length
  const refAtCapacity = refCount >= MAX_CHARACTER_REFS

  const totalCount = memoryPhotos.length + memoryUpload.pending.length

  const handleMemoryFiles = useCallback(
    (files: FileList | File[]) => {
      if (storyId === null) return
      const remaining = MAX_PHOTOS - totalCount
      if (remaining <= 0) return
      const list = Array.from(files).slice(0, remaining)
      void memoryUpload.uploadMany(list)
    },
    [storyId, memoryUpload, totalCount],
  )

  const handleRefFiles = useCallback(
    (files: FileList | File[]) => {
      if (storyId === null) return
      const remaining = MAX_CHARACTER_REFS - refCount
      if (remaining <= 0) {
        showToast(`대표 사진은 최대 ${MAX_CHARACTER_REFS}장까지 업로드할 수 있어요.`)
        return
      }
      const list = Array.from(files).slice(0, remaining)
      void refUpload.uploadMany(list)
    },
    [storyId, refUpload, refCount, showToast],
  )

  const handleRemove = useCallback(
    (photoId: number) => {
      deleteMutation.mutate(photoId, {
        onError: err => {
          if (isApiError(err)) {
            if (err.code === 'STORY_021') {
              showToast('스토리보드 생성이 시작되어 대표 사진을 삭제할 수 없어요.')
              return
            }
            if (err.code === 'STORY_022') {
              showToast('본문이 이미 생성되어 사진을 변경할 수 없어요.')
              // 캐시가 stale 했을 수 있으니 SUMMARY 상태 즉시 refetch — 다음 렌더에 lock UI 노출.
              void summaryQuery.refetch()
              return
            }
          }
          showToast('삭제에 실패했어요.')
        },
      })
    },
    [deleteMutation, showToast, summaryQuery],
  )

  /** 인접 swap 후 reorder 전체 list 전송 — 추억 zone 만 정렬 가능. */
  const handleMemoryMove = useCallback(
    (photoId: number, direction: -1 | 1) => {
      const ids = memoryPhotos.map(p => p.photoId)
      const idx = ids.indexOf(photoId)
      const target = idx + direction
      if (idx < 0 || target < 0 || target >= ids.length) return
      ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
      reorderMutation.mutate(ids)
    },
    [memoryPhotos, reorderMutation],
  )

  const handleMemoryDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const ids = memoryPhotos.map(p => p.photoId)
      const fromIdx = ids.indexOf(Number(active.id))
      const toIdx = ids.indexOf(Number(over.id))
      if (fromIdx === -1 || toIdx === -1) return
      const next = arrayMove(ids, fromIdx, toIdx)
      reorderMutation.mutate(next)
    },
    [memoryPhotos, reorderMutation],
  )

  /** 별 토글 핸들러 — 추억 카드 footer 별 버튼. on=true 시 max-3 합산 사전 검증. */
  const handleToggleRef = useCallback(
    (photoId: number, currentlyOn: boolean) => {
      const next = !currentlyOn
      // ON 으로 가는데 이미 합산 max 면 사전 차단 — BE 까지 가지 않고 toast.
      if (next && refAtCapacity) {
        showToast(`대표 사진은 최대 ${MAX_CHARACTER_REFS}장까지 선택할 수 있어요.`)
        return
      }
      toggleMutation.mutate(
        { photoId, on: next },
        {
          onError: err => {
            if (isApiError(err)) {
              if (err.code === 'STORY_020') {
                showToast(`대표 사진은 최대 ${MAX_CHARACTER_REFS}장까지 선택할 수 있어요.`)
                return
              }
              if (err.code === 'STORY_021') {
                showToast('스토리보드 생성이 시작되어 대표 사진을 변경할 수 없어요.')
                return
              }
              if (err.code === 'STORY_022') {
                showToast('본문이 이미 생성되어 사진을 변경할 수 없어요.')
                void summaryQuery.refetch()
                return
              }
            }
            showToast('대표 지정에 실패했어요.')
          },
        },
      )
    },
    [toggleMutation, refAtCapacity, showToast, summaryQuery],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const memoryPending = memoryUpload.pending
  const refPending = refUpload.pending

  /**
   * "스토리 만들기" 클릭 시 사전 가드 — 대표 사진 미선택이면 모달로 안내 후 navigate 막음.
   *
   * 추억 사진 / pending upload 같은 다른 부적절 상태는 BE 단의 검증으로 위임 (여기선 통과).
   * 사용자 요청: 버튼은 항상 클릭 가능 + 대표 0 시에만 친절히 안내.
   */
  const [showRefRequiredModal, setShowRefRequiredModal] = useState(false)
  const handleNextClick = () => {
    if (refCount === 0) {
      setShowRefRequiredModal(true)
      return
    }
    onNext()
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <CreationHeader currentStep={2} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-7xl mx-auto pb-12">
            <StepTitleBlock
              stepNumber={2}
              title="추억의 사진을 모아주세요"
              subtitle="10장 이상 올려주시면 훨씬 풍성한 동화가 돼요"
            />

            {/* storyId 없으면 경고 */}
            {storyId === null && (
              <div className="bg-[#D8857C]/20 border border-[#B0473F]/40 text-[#3E2A18] text-sm px-4 py-3 rounded-xl mb-4">
                ⚠ step 1 저장이 완료되지 않았습니다. 이전 단계로 돌아가 다시 시도해주세요.
              </div>
            )}

            {/* SUMMARY 락 안내 — 본문 생성이 시작/완료된 스토리는 사진 변경 불가. */}
            {isSummaryLocked && (
              <div
                className="bg-[#fff7d6] border-2 border-[#E8A832]/60 text-[#8b6a14] text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2"
                role="status"
              >
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">본문이 생성되어 이 단계는 읽기 전용이에요.</p>
                  <p className="text-xs mt-1 opacity-90">
                    사진을 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 진행하면 본문/이미지를 이어 작업할 수 있어요.
                  </p>
                </div>
              </div>
            )}

            {/* ─── 추억 사진 zone ─────────────────────────────────────── */}
            {!isSummaryLocked && <PhotoUploadZone onFiles={handleMemoryFiles} />}

            <div className="space-y-4 mb-12">
              <h3 className="text-xl text-[#3E2A18] border-b border-[#9A7548]/40 pb-2 font-bold flex justify-between items-center">
                <span>업로드된 사진</span>
                <span className="bg-[#E9DBBE] text-[#3F6B2E] px-3 py-1 rounded-full text-sm border border-[#9A7548]/40 font-sans shadow-sm">
                  {totalCount} / {MAX_PHOTOS} 장
                </span>
              </h3>

              {photosQuery.isPending && storyId !== null && (
                <div className="flex items-center justify-center gap-2 text-[#76695A] py-8">
                  <Loader2 className="w-5 h-5 animate-spin" /> 사진 목록 불러오는 중…
                </div>
              )}

              {!photosQuery.isPending && totalCount === 0 && <EmptyPhotoState />}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleMemoryDragEnd}
              >
                <SortableContext
                  items={memoryPhotos.map(p => p.photoId)}
                  strategy={verticalListSortingStrategy}
                >
                  {memoryPhotos.map((photo, idx) => (
                    <PhotoItem
                      key={`memory-${photo.photoId}`}
                      id={photo.photoId}
                      mode="committed"
                      imageUrl={photo.imageUrl}
                      description={photo.description}
                      tagsJson={photo.tagsJson}
                      purpose={photo.purpose}
                      onRemove={() => handleRemove(photo.photoId)}
                      onUpdate={patch => updateMutation.mutate({ photoId: photo.photoId, body: patch })}
                      onMoveUp={() => handleMemoryMove(photo.photoId, -1)}
                      onMoveDown={() => handleMemoryMove(photo.photoId, 1)}
                      onCharacterRefToggle={() =>
                        handleToggleRef(photo.photoId, photo.purpose === 'BOTH')
                      }
                      isCharacterRefToggling={
                        toggleMutation.isPending && toggleMutation.variables?.photoId === photo.photoId
                      }
                      isFirst={idx === 0}
                      isLast={idx === memoryPhotos.length - 1}
                      isRemoving={deleteMutation.isPending && deleteMutation.variables === photo.photoId}
                      isReordering={reorderMutation.isPending}
                      isMutationLocked={isSummaryLocked}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {memoryPending.map(p =>
                p.status === 'uploading' ? (
                  <PhotoItem
                    key={`memory-pending-${p.tempId}`}
                    mode="uploading"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                  />
                ) : (
                  <PhotoItem
                    key={`memory-pending-${p.tempId}`}
                    mode="error"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                    error={p.error ?? '알 수 없는 오류'}
                    onDismiss={() => memoryUpload.dismissPending(p.tempId)}
                  />
                ),
              )}
            </div>

            {/* ─── 대표 사진 (캐릭터 reference) zone ──────────────────── */}
            <div className="border-t-2 border-[#9A7548]/30 pt-8 mb-4">
              <h3 className="text-xl text-[#3E2A18] pb-2 font-bold flex justify-between items-center mb-1">
                <span className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#E8A832]" fill="#E8A832" />
                  대표 사진 (캐릭터 reference)
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm border font-sans shadow-sm ${
                    refCount === 0
                      ? 'bg-[#fbe9e7] text-[#a3413f] border-[#a3413f]/40'
                      : 'bg-[#fff7d6] text-[#8b6a14] border-[#E8A832]/60'
                  }`}
                >
                  대표 {refCount} / {MAX_CHARACTER_REFS}
                </span>
              </h3>
              <p className="text-sm text-[#6B4A28] mb-4">
                가족이 모두 잘 나온 사진을 골라주세요. 캐릭터 일관성을 위해 동화의 모든 장면에 참고됩니다.<br />
                <span className="text-[#3F6B2E] font-bold">
                  추억 사진에서 별 ★ 을 누르면 대표로도 사용 — 또는 아래에서 별도로 업로드 가능.
                </span>
              </p>

              {isSummaryLocked ? null : refAtCapacity ? (
                <div className="bg-[#fff7d6] border-2 border-[#E8A832]/60 text-[#8b6a14] text-sm px-4 py-3 rounded-xl">
                  대표 사진이 최대치({MAX_CHARACTER_REFS}장) 에 도달했어요. 추가하려면 기존 대표 사진을 해제하거나 삭제해주세요.
                </div>
              ) : (
                <PhotoUploadZone onFiles={handleRefFiles} />
              )}

              {refOnlyPhotos.length > 0 && (
                <div className="space-y-4 mt-4">
                  {refOnlyPhotos.map(photo => (
                    <PhotoItem
                      key={`ref-${photo.photoId}`}
                      id={photo.photoId}
                      mode="committed"
                      imageUrl={photo.imageUrl}
                      description={photo.description}
                      tagsJson={photo.tagsJson}
                      purpose={photo.purpose}
                      onRemove={() => handleRemove(photo.photoId)}
                      onUpdate={patch =>
                        updateMutation.mutate({ photoId: photo.photoId, body: patch })
                      }
                      onMoveUp={() => {}}
                      onMoveDown={() => {}}
                      isFirst
                      isLast
                      isRemoving={deleteMutation.isPending && deleteMutation.variables === photo.photoId}
                      isMutationLocked={isSummaryLocked}
                    />
                  ))}
                </div>
              )}

              {refPending.map(p =>
                p.status === 'uploading' ? (
                  <PhotoItem
                    key={`ref-pending-${p.tempId}`}
                    mode="uploading"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                  />
                ) : (
                  <PhotoItem
                    key={`ref-pending-${p.tempId}`}
                    mode="error"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                    error={p.error ?? '알 수 없는 오류'}
                    onDismiss={() => refUpload.dismissPending(p.tempId)}
                  />
                ),
              )}
            </div>

          </div>
        </main>
      </div>

      <CreationFooter
        currentStep={2}
        onBack={onBack}
        onNext={handleNextClick}
        nextLabel="다음: 스토리 만들기"
        rightSlot={
          <button
            type="button"
            onClick={handleNextClick}
            className="flex items-center gap-1.5 bg-[#8DBA64] text-[#1F3318] px-5 py-2 rounded-full border-2 border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all font-bold text-sm whitespace-nowrap"
          >
            다음: 스토리 만들기 <Wand2 className="w-4 h-4" />
          </button>
        }
      />

      {showRefRequiredModal && (
        <CharacterRefRequiredModal onClose={() => setShowRefRequiredModal(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[6000] bg-[#3E2A18] text-[#F4E4BC] px-5 py-3 rounded-full shadow-lg text-sm font-bold">
          {toast}
        </div>
      )}
    </div>
  )
}

/**
 * 대표 사진 미선택 안내 모달.
 *
 * "다음: 스토리 만들기" 클릭 시 reference 가 0 장이면 노출. 사용자가 추억 카드의 별 ★ 토글
 * 또는 별도 업로드 zone 을 통해 대표 사진을 1장 이상 선택해야 다음 단계로 갈 수 있다.
 *
 * 단순 정보 모달 — "확인" 버튼 1개로 닫기. 백드롭 / ESC 도 닫기.
 */
function CharacterRefRequiredModal({ onClose }: { onClose: () => void }) {
  // ESC 로 닫기.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-required-modal-title"
    >
      <div
        className="bg-[#F4E4BC] border-2 border-[#9A7548]/60 rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] w-full max-w-md p-7 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#fff7d6] border-2 border-[#E8A832] flex items-center justify-center shrink-0">
            <Star className="w-6 h-6 text-[#E8A832]" fill="#E8A832" />
          </div>
          <h2
            id="ref-required-modal-title"
            className="text-xl font-bold text-[#3E2A18]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            대표 사진을 1장 이상 골라주세요
          </h2>
        </div>

        <div className="text-sm text-[#3E2A18] space-y-2 leading-relaxed">
          <p>
            동화 속 캐릭터가 모든 페이지에서 일관되게 보이려면 <b>가족이 잘 나온 사진</b> 이 필요해요.
          </p>
          <p>아래 두 방법 중 하나로 골라주세요:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>
              추억 사진 카드의 <b className="text-[#8b6a14]">★ 대표로 지정</b> 버튼
            </li>
            <li>
              <b>대표 사진 zone</b> 에 별도로 업로드 (가족 사진 추가)
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#8DBA64] text-[#1F3318] px-6 py-2.5 rounded-full border-2 border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all font-bold text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
