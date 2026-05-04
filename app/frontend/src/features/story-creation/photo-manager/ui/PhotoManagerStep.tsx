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
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
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
import '../../styles/creation-paper.css'

const MAX_CHARACTER_REFS = 3

interface PhotoManagerStepProps {
  storyId: number | null
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 02 — paper-craft 톤 (Claude offline.html 1:1).
 *
 * 두 zone:
 *  1. 추억 사진 zone — STORYBOARD/BOTH purpose. 카드별 ★ 토글로 BOTH ↔ STORYBOARD.
 *  2. 대표 사진 zone — CHARACTER_REF only. 별도 업로드 영역.
 *
 * 모든 mutation/검증/lock 로직은 기존 그대로 유지하고 마크업/스타일만 cr-* 클래스로 갈아엎음.
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

  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const summaryStatus = summaryQuery.data?.jobStatus ?? null
  const isSummaryLocked =
    summaryStatus === 'PENDING' || summaryStatus === 'RUNNING' || summaryStatus === 'SUCCESS'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const allPhotos = photosQuery.data ?? []
  const memoryPhotos = allPhotos.filter(p => p.purpose === 'STORYBOARD' || p.purpose === 'BOTH')
  const refOnlyPhotos = allPhotos.filter(p => p.purpose === 'CHARACTER_REF')
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

  const handleToggleRef = useCallback(
    (photoId: number, currentlyOn: boolean) => {
      const next = !currentlyOn
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const memoryPending = memoryUpload.pending
  const refPending = refUpload.pending

  const [showRefRequiredModal, setShowRefRequiredModal] = useState(false)
  const handleNextClick = () => {
    if (refCount === 0) {
      setShowRefRequiredModal(true)
      return
    }
    onNext()
  }

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={2} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={2}
            title="추억의 사진을 모아주세요"
            subtitle="10장 이상 올려주시면 풍성한 동화가 돼요"
          />

          <div className="cr-hero-banner">
            <div className="body">
              가족이 모두 잘 나온 사진을 골라주세요. AI 가 일관성 있게 동화 속 주인공의 모습을 그려줍니다.
              <br />
              아래 <strong>'추억의 사진'</strong> 카드에 사진을 올린 뒤 <span className="gold">★</span> 대표로
              지정 버튼을 누르거나, 페이지 아래쪽 <strong>'대표 사진'</strong> 영역에 직접 올릴 수도 있어요.
            </div>
          </div>

          {storyId === null && (
            <div className="cr-banner error" role="alert">
              <span>⚠ Step 1 저장이 완료되지 않았어요. 이전 단계로 돌아가 다시 시도해주세요.</span>
            </div>
          )}

          {isSummaryLocked && (
            <div className="cr-banner" role="status">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <strong>본문이 생성되어 이 단계는 읽기 전용이에요.</strong>
                <span style={{ fontSize: 14, opacity: 0.9 }}>
                  사진을 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 진행하면 본문/이미지를
                  이어 작업할 수 있어요.
                </span>
              </div>
            </div>
          )}

          {/* ─── 추억 사진 zone ─────────────────────────── */}
          {!isSummaryLocked && (
            <div className="cr-card">
              <span className="cr-tape" aria-hidden="true" />
              <PhotoUploadZone
                onFiles={handleMemoryFiles}
                metaText={`최대 ${MAX_PHOTOS}장 · JPG, PNG · 한 장당 10MB 이하`}
              />
            </div>
          )}

          <div className="cr-section-head">
            <div className="ttl">업로드된 사진</div>
            <div className="cr-pill-counter">
              {totalCount} / {MAX_PHOTOS} 장
            </div>
          </div>

          <div className="cr-card" style={{ padding: 18 }}>
            <span className="cr-tape" aria-hidden="true" />

            {photosQuery.isPending && storyId !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '32px 0',
                  color: 'var(--cr-ink-soft)',
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontSize: 16,
                }}
              >
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
                    onUpdate={patch =>
                      updateMutation.mutate({ photoId: photo.photoId, body: patch })
                    }
                    onMoveUp={() => handleMemoryMove(photo.photoId, -1)}
                    onMoveDown={() => handleMemoryMove(photo.photoId, 1)}
                    onCharacterRefToggle={() =>
                      handleToggleRef(photo.photoId, photo.purpose === 'BOTH')
                    }
                    isCharacterRefToggling={
                      toggleMutation.isPending &&
                      toggleMutation.variables?.photoId === photo.photoId
                    }
                    isFirst={idx === 0}
                    isLast={idx === memoryPhotos.length - 1}
                    isRemoving={
                      deleteMutation.isPending && deleteMutation.variables === photo.photoId
                    }
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

          {/* ─── 대표 사진 (캐릭터 reference) zone ───────────── */}
          <div className="cr-section-head" style={{ marginTop: 32 }}>
            <div className="ttl">
              <Star
                className="w-5 h-5"
                style={{ color: 'var(--cr-gold)' }}
                fill="var(--cr-gold)"
              />
              대표 사진{' '}
              <span
                style={{
                  fontFamily: "'Gaegu', cursive",
                  color: 'var(--cr-ink-soft)',
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                (character reference)
              </span>
            </div>
            <div className={`cr-pill-counter ${refCount === 0 ? 'alert' : 'gold'}`}>
              대표 {refCount} / {MAX_CHARACTER_REFS}
            </div>
          </div>

          {!isSummaryLocked && refAtCapacity ? (
            <div className="cr-banner" role="status">
              대표 사진이 최대치({MAX_CHARACTER_REFS}장)에 도달했어요. 추가하려면 기존 대표
              사진을 해제하거나 삭제해주세요.
            </div>
          ) : !isSummaryLocked ? (
            <div className="cr-card" style={{ padding: 18 }}>
              <span className="cr-tape" aria-hidden="true" />
              <PhotoUploadZone
                onFiles={handleRefFiles}
                metaText={`최대 ${MAX_CHARACTER_REFS}장 · JPG, PNG`}
              />
            </div>
          ) : null}

          {refOnlyPhotos.length > 0 && (
            <div style={{ marginTop: 16 }}>
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
                  isRemoving={
                    deleteMutation.isPending && deleteMutation.variables === photo.photoId
                  }
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
        </main>
      </div>

      <CreationFooter
        currentStep={2}
        onBack={onBack}
        rightSlot={
          <button type="button" onClick={handleNextClick} className="cr-btn-next">
            <span>이런 스토리 만들기</span>
            <Wand2 className="w-4 h-4" />
          </button>
        }
      />

      {showRefRequiredModal && (
        <CharacterRefRequiredModal onClose={() => setShowRefRequiredModal(false)} />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6000,
            background: 'var(--cr-ink)',
            color: 'var(--cr-paper)',
            padding: '10px 20px',
            borderRadius: 999,
            fontFamily: 'var(--cr-font-gaegu)',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function CharacterRefRequiredModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 7000,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(60, 40, 20, 0.5)',
        backdropFilter: 'blur(2px)',
        padding: 20,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-required-modal-title"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
          border: '2.5px solid var(--cr-caramel-deep)',
          borderRadius: 22,
          padding: '26px 28px',
          boxShadow:
            '0 4px 0 var(--cr-caramel-deep), 0 16px 36px rgba(60, 40, 20, 0.35)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#fff5d8',
              border: '2px solid var(--cr-gold)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Star className="w-6 h-6" style={{ color: 'var(--cr-gold)' }} fill="var(--cr-gold)" />
          </div>
          <h3
            id="ref-required-modal-title"
            style={{
              fontFamily: 'var(--cr-font-serif)',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--cr-ink)',
              margin: 0,
              letterSpacing: '-0.5px',
            }}
          >
            대표 사진을 1장 이상 골라주세요
          </h3>
        </div>

        <div
          style={{
            fontFamily: 'var(--cr-font-gaegu)',
            fontSize: 16,
            color: 'var(--cr-ink)',
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            동화 속 캐릭터가 모든 페이지에서 일관되게 보이려면 <strong>가족이 잘 나온 사진</strong>이 필요해요.
          </p>
          <p style={{ margin: '0 0 6px' }}>아래 두 방법 중 하나로 골라주세요:</p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              추억 사진 카드의 <strong style={{ color: '#8a6a18' }}>★ 대표로 지정</strong> 버튼
            </li>
            <li>
              <strong>대표 사진 zone</strong> 에 별도로 업로드 (가족 사진 추가)
            </li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="cr-btn-next">
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
