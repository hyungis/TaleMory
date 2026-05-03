import { useEffect, useState, type CSSProperties } from 'react'
import {
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Star,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PhotoPurposeApi } from '../api/types'

function parseTagsJson(json: string | null | undefined): string {
  if (!json) return ''
  try {
    const parsed = JSON.parse(json)
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return ''
  }
}

interface PhotoItemCommittedProps {
  mode: 'committed'
  id: number
  imageUrl: string
  description: string | null
  tagsJson: string | null
  onRemove: () => void
  onUpdate: (patch: { description?: string; tagsJson?: string }) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  isRemoving?: boolean
  isReordering?: boolean
  purpose?: PhotoPurposeApi
  onCharacterRefToggle?: (next: boolean) => void
  isCharacterRefToggling?: boolean
  isCharacterRefLocked?: boolean
  isMutationLocked?: boolean
}

interface PhotoItemUploadingProps {
  mode: 'uploading'
  previewUrl: string
  fileName: string
}

interface PhotoItemErrorProps {
  mode: 'error'
  previewUrl: string
  fileName: string
  error: string
  onDismiss: () => void
}

type PhotoItemProps = PhotoItemCommittedProps | PhotoItemUploadingProps | PhotoItemErrorProps

/**
 * paper-craft 톤 PhotoItem — Claude offline.html 의 `.photo-card` 1:1.
 * 3-column grid: drag grip / photo-thumb 140x140 / photo-meta (description + tags + ★ 토글).
 */
export function PhotoItem(props: PhotoItemProps) {
  if (props.mode === 'committed') {
    return <SortablePhotoItem {...props} />
  }
  return <StaticPhotoItem {...props} />
}

function SortablePhotoItem(props: PhotoItemCommittedProps) {
  const sortableDisabled = props.isReordering || !!props.isMutationLocked
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
    disabled: sortableDisabled,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    cursor: sortableDisabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cr-photo-card${isDragging ? ' dragging' : ''}`}
    >
      <span className="cr-drag-grip" aria-hidden="true">
        <GripVertical className="w-4 h-4" />
      </span>

      <div className="cr-photo-thumb">
        <Thumbnail props={props} />
      </div>

      <PhotoMeta
        description={props.description}
        tagsJson={props.tagsJson}
        onUpdate={props.onUpdate}
        purpose={props.purpose}
        onCharacterRefToggle={props.onCharacterRefToggle}
        isCharacterRefToggling={props.isCharacterRefToggling}
        isCharacterRefLocked={props.isCharacterRefLocked}
        isMutationLocked={props.isMutationLocked}
      />

      {!props.isMutationLocked && (
        <div className="cr-photo-actions">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              props.onMoveUp()
            }}
            onPointerDown={e => e.stopPropagation()}
            disabled={props.isFirst || props.isReordering}
            title="위로 이동"
            aria-label="위로 이동"
            className="cr-photo-action"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              props.onMoveDown()
            }}
            onPointerDown={e => e.stopPropagation()}
            disabled={props.isLast || props.isReordering}
            title="아래로 이동"
            aria-label="아래로 이동"
            className="cr-photo-action"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              props.onRemove()
            }}
            onPointerDown={e => e.stopPropagation()}
            disabled={props.isRemoving}
            title="사진 삭제"
            aria-label="사진 삭제"
            className="cr-photo-action danger"
          >
            {props.isRemoving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function StaticPhotoItem(props: PhotoItemUploadingProps | PhotoItemErrorProps) {
  return (
    <div
      className="cr-photo-card"
      style={{
        borderColor: props.mode === 'error' ? 'var(--cr-rust)' : undefined,
      }}
    >
      <span className="cr-drag-grip" aria-hidden="true" style={{ opacity: 0.4 }}>
        <GripVertical className="w-4 h-4" />
      </span>

      <div className="cr-photo-thumb">
        <Thumbnail props={props} />
      </div>

      <div className="cr-photo-meta">
        <StatusText {...props} />
      </div>

      {props.mode === 'error' && (
        <div className="cr-photo-actions" style={{ opacity: 1 }}>
          <button
            type="button"
            onClick={props.onDismiss}
            title="에러 무시"
            aria-label="에러 무시"
            className="cr-photo-action danger"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function Thumbnail({ props }: { props: PhotoItemProps }) {
  const previewSrc = props.mode === 'committed' ? props.imageUrl : props.previewUrl
  return (
    <>
      {previewSrc ? (
        <img src={previewSrc} alt="사진" draggable={false} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <ImageIcon className="w-10 h-10" />
        </div>
      )}
      {props.mode === 'uploading' && (
        <div className="cr-uploading-overlay">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
    </>
  )
}

function PhotoMeta({
  description,
  tagsJson,
  onUpdate,
  purpose,
  onCharacterRefToggle,
  isCharacterRefToggling,
  isCharacterRefLocked,
  isMutationLocked,
}: {
  description: string | null
  tagsJson: string | null
  onUpdate: (patch: { description?: string; tagsJson?: string }) => void
  purpose?: PhotoPurposeApi
  onCharacterRefToggle?: (next: boolean) => void
  isCharacterRefToggling?: boolean
  isCharacterRefLocked?: boolean
  isMutationLocked?: boolean
}) {
  const [descLocal, setDescLocal] = useState(description ?? '')
  const [tagsLocal, setTagsLocal] = useState(parseTagsJson(tagsJson))

  useEffect(() => {
    setDescLocal(description ?? '')
  }, [description])
  useEffect(() => {
    setTagsLocal(parseTagsJson(tagsJson))
  }, [tagsJson])

  function handleDescBlur() {
    const serverValue = description ?? ''
    if (descLocal !== serverValue) {
      onUpdate({ description: descLocal })
    }
  }

  function handleTagsBlur() {
    const serverValue = parseTagsJson(tagsJson)
    if (tagsLocal !== serverValue) {
      onUpdate({ tagsJson: JSON.stringify(tagsLocal) })
    }
  }

  const stopDragPointer = (e: React.PointerEvent) => e.stopPropagation()

  const isOn = purpose === 'BOTH'

  return (
    <div className="cr-photo-meta">
      <div>
        <div className="mini-label">
          사진 설명 <span className="req">*</span>
        </div>
        <input
          type="text"
          placeholder="예: OO이가 처음으로 바다에 발을 담근 날"
          value={descLocal}
          onChange={e => setDescLocal(e.target.value)}
          onBlur={handleDescBlur}
          onPointerDown={stopDragPointer}
          readOnly={!!isMutationLocked}
          disabled={!!isMutationLocked}
          className="cr-input"
        />
      </div>
      <div>
        <div className="mini-label">태그</div>
        <input
          type="text"
          placeholder="예: 모래성 쌓기, 첫 바다, #OO이첫바다"
          value={tagsLocal}
          onChange={e => setTagsLocal(e.target.value)}
          onBlur={handleTagsBlur}
          onPointerDown={stopDragPointer}
          readOnly={!!isMutationLocked}
          disabled={!!isMutationLocked}
          className="cr-input"
        />
      </div>

      {onCharacterRefToggle && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onCharacterRefToggle(!isOn)
          }}
          onPointerDown={stopDragPointer}
          disabled={isCharacterRefToggling || isCharacterRefLocked || isMutationLocked}
          className={`cr-star-btn${isOn ? ' on' : ''}`}
          title={
            isCharacterRefLocked
              ? '스토리보드 생성이 시작되어 변경할 수 없어요'
              : isOn
                ? '대표 해제'
                : '이 사진을 대표 사진으로 지정'
          }
        >
          {isCharacterRefToggling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Star
              className="w-3.5 h-3.5"
              fill={isOn ? '#fff' : 'none'}
              stroke="currentColor"
            />
          )}
          <span>{isOn ? '대표 ★' : '대표로 지정'}</span>
        </button>
      )}
    </div>
  )
}

function StatusText(props: PhotoItemUploadingProps | PhotoItemErrorProps) {
  if (props.mode === 'uploading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
        <div
          style={{
            fontSize: 15,
            color: 'var(--cr-sage-deep)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--cr-font-gaegu)',
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중…
        </div>
        <div style={{ fontSize: 13, color: 'var(--cr-ink-soft)', opacity: 0.7 }}>
          {props.fileName}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
      <div
        style={{
          fontSize: 15,
          color: 'var(--cr-rust)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--cr-font-gaegu)',
        }}
      >
        <AlertCircle className="w-4 h-4" /> 업로드 실패
      </div>
      <div style={{ fontSize: 13, color: 'var(--cr-ink-soft)', opacity: 0.7 }}>
        {props.fileName}
      </div>
      <div style={{ fontSize: 12, color: 'var(--cr-rust)' }}>{props.error}</div>
    </div>
  )
}
