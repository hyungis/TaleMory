import { useCallback } from 'react'
import { Image as ImageIcon, Loader2, Wand2 } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { StepHeader } from '../../ui/StepHeader'
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
   *  - KeyboardSensor : Tab + Space 로 잡고 화살표 키로 이동 (a11y).
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const canProceed = serverPhotos.length > 0 && upload.pending.every(p => p.status === 'error' || false)

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={2} stepTitle="추억 사진 선택 & 태깅" onBack={onBack} />

      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto pb-12">
            {/* 타이틀 영역 */}
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <ImageIcon className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#f0e6c0] font-bold">추억이 담긴 사진을 올려주세요</h2>
              <p className="text-[#b4c4a4] mt-2">
                업로드된 사진들이 모여 멋진 동화책의 뼈대가 됩니다.
              </p>
            </div>

            {/* storyId 없으면 경고 */}
            {storyId === null && (
              <div className="bg-[#8b3a2a]/15 border border-[#8b3a2a]/40 text-[#f0e6c0] text-sm px-4 py-3 rounded-xl mb-4">
                ⚠ step 1 저장이 완료되지 않았습니다. 이전 단계로 돌아가 다시 시도해주세요.
              </div>
            )}

            {/* 업로드 영역 */}
            <PhotoUploadZone onFiles={handleFiles} />

            {/* 업로드된 사진 리스트 */}
            <div className="space-y-4 mb-8">
              <h3 className="text-xl text-[#f0e6c0] border-b border-[#4a3a24] pb-2 font-bold flex justify-between items-center">
                <span>업로드된 사진</span>
                <span className="bg-[#2a1b12]/70 text-[#b4dc8c] px-3 py-1 rounded-full text-sm border border-[#b4dc8c]/50 font-sans shadow-sm">
                  {totalCount} / {MAX_PHOTOS} 장
                </span>
              </h3>

              {photosQuery.isPending && storyId !== null && (
                <div className="flex items-center justify-center gap-2 text-[#b4c4a4] py-8">
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

            {/* 하단 액션 바 */}
            <div className="flex justify-between items-center pt-6 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-lg font-bold transition-colors"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canProceed}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                다음: 스토리 만들기 <Wand2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
