import { useCallback } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
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
import { MAX_PHOTOS } from '../lib/constants'

interface PhotoManagerStepProps {
  /** BasicInfoStep 에서 POST/PATCH 후 받은 story id. null 이면 업로드 불가 상태로 fallback. */
  storyId: number | null
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 02 — 추억 사진 업로드 & 스토리보드 프롬프트.
 *
 * 서버 상태 관리:
 *  - `usePhotosQuery(storyId)` — 커밋된 사진 목록 (presigned GET URL 포함)
 *  - `usePhotoUpload(storyId)` — 3-phase 업로드 (presign → S3 PUT → commit) + pending 로컬 상태
 *  - `useDeletePhoto(storyId)` — soft delete + 목록 invalidate
 *
 * 로컬 상태는 업로드 중/실패인 사진만 보관. commit 성공한 사진은 useQuery 의 서버 데이터로 승격.
 */
export function PhotoManagerStep({ storyId, onBack, onNext }: PhotoManagerStepProps) {
  const photosQuery = usePhotosQuery(storyId)
  const upload = usePhotoUpload(storyId)
  const deleteMutation = useDeletePhoto(storyId)
  const updateMutation = useUpdatePhoto(storyId)
  const reorderMutation = useReorderPhotos(storyId)

  const serverPhotos = photosQuery.data ?? []
  const totalCount = serverPhotos.length + upload.pending.length

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (storyId === null) return
      const remaining = MAX_PHOTOS - totalCount
      if (remaining <= 0) return
      const list = Array.from(files).slice(0, remaining)
      void upload.uploadMany(list)
    },
    [storyId, upload, totalCount],
  )

  const handleRemove = useCallback(
    (photoId: number) => {
      deleteMutation.mutate(photoId)
    },
    [deleteMutation],
  )

  /**
   * 인접한 두 사진의 순서를 swap 후 서버에 전체 목록 전송.
   * direction=-1 → 위로, +1 → 아래로.
   * reorder mutation 은 전체 목록을 보내야 하므로 `serverPhotos` 기준으로 계산.
   */
  const handleMove = useCallback(
    (photoId: number, direction: -1 | 1) => {
      const ids = serverPhotos.map(p => p.photoId)
      const idx = ids.indexOf(photoId)
      const target = idx + direction
      if (idx < 0 || target < 0 || target >= ids.length) return
      ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
      reorderMutation.mutate(ids)
    },
    [serverPhotos, reorderMutation],
  )

  /**
   * dnd-kit DragEnd 핸들러 — 드롭 위치 기준으로 새 순서 계산 후 서버 PATCH.
   * activationConstraint(distance:8) 덕분에 짧은 클릭은 drag 로 변환되지 않아 input/button 방해 X.
   * useReorderPhotos 의 onMutate 가 낙관적 업데이트로 즉시 캐시 재배열 → 깜빡임 없음.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const ids = serverPhotos.map(p => p.photoId)
      const fromIdx = ids.indexOf(Number(active.id))
      const toIdx = ids.indexOf(Number(over.id))
      if (fromIdx === -1 || toIdx === -1) return
      const next = arrayMove(ids, fromIdx, toIdx)
      reorderMutation.mutate(next)
    },
    [serverPhotos, reorderMutation],
  )

  /**
   * dnd-kit sensors:
   *  - PointerSensor (마우스 + 터치) : distance 8px 이상 이동해야 drag 활성 → 짧은 클릭은 input/button 으로 통과.
   *
   * KeyboardSensor 는 의도적으로 제거: input 에서 친 Space 가 root 카드의 keydown 핸들러로
   * 버블링되면 카드가 active drag 상태로 진입해 검은 오버레이가 깔리는 사고가 있었다.
   * 키보드 a11y 는 카드 우상단의 위/아래 화살표 버튼(onMoveUp/Down) 으로 대체.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const canProceed = serverPhotos.length > 0 && upload.pending.every(p => p.status === 'error' || false)

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

            {/* 업로드 영역 */}
            <PhotoUploadZone onFiles={handleFiles} />

            {/* 업로드된 사진 리스트 */}
            <div className="space-y-4 mb-8">
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

              {/* 서버 커밋된 사진 — DndContext + SortableContext 안에서 순서 변경 가능.
                  uploading/error 카드는 이 context 밖에 있어 드래그 대상 X. */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={serverPhotos.map(p => p.photoId)}
                  strategy={verticalListSortingStrategy}
                >
                  {serverPhotos.map((photo, idx) => (
                    <PhotoItem
                      key={`server-${photo.photoId}`}
                      id={photo.photoId}
                      mode="committed"
                      imageUrl={photo.imageUrl}
                      description={photo.description}
                      tagsJson={photo.tagsJson}
                      onRemove={() => handleRemove(photo.photoId)}
                      onUpdate={patch => updateMutation.mutate({ photoId: photo.photoId, body: patch })}
                      onMoveUp={() => handleMove(photo.photoId, -1)}
                      onMoveDown={() => handleMove(photo.photoId, 1)}
                      isFirst={idx === 0}
                      isLast={idx === serverPhotos.length - 1}
                      isRemoving={deleteMutation.isPending && deleteMutation.variables === photo.photoId}
                      isReordering={reorderMutation.isPending}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* 업로드 중/실패 */}
              {upload.pending.map(p =>
                p.status === 'uploading' ? (
                  <PhotoItem
                    key={`pending-${p.tempId}`}
                    mode="uploading"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                  />
                ) : (
                  <PhotoItem
                    key={`pending-${p.tempId}`}
                    mode="error"
                    previewUrl={p.previewUrl}
                    fileName={p.fileName}
                    error={p.error ?? '알 수 없는 오류'}
                    onDismiss={() => upload.dismissPending(p.tempId)}
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
        onNext={onNext}
        nextLabel="다음: 스토리 만들기"
        nextDisabled={!canProceed}
        rightSlot={
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            className="flex items-center gap-1.5 bg-[#8DBA64] text-[#1F3318] px-5 py-2 rounded-full border-2 border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_#3F6B2E] transition-all font-bold text-sm whitespace-nowrap"
          >
            다음: 스토리 만들기 <Wand2 className="w-4 h-4" />
          </button>
        }
      />
    </div>
  )
}
