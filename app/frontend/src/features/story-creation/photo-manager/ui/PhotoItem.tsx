import { X } from 'lucide-react'
import type { PhotoItem as PhotoItemType } from '../../model/types'

interface PhotoItemProps {
  photo: PhotoItemType
  onRemove: () => void
  onTagsChange: (tags: string[]) => void
}

/**
 * 개별 사진 썸네일 + 콤마 기반 태그 입력.
 */
export function PhotoItem({ photo, onRemove, onTagsChange }: PhotoItemProps) {
  const tagsValue = photo.tags.join(', ')

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#e8ddb4] border-2 border-[#8b7a52]/60 flex flex-col">
      <div className="relative aspect-square bg-[#2a1b12]">
        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          aria-label="사진 삭제"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#8b3a2a] text-[#f0e6c0] flex items-center justify-center hover:bg-[#a84a35] shadow-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs text-[#8b7a52] truncate" title={photo.name}>
          {photo.name}
        </p>
        <input
          type="text"
          placeholder="태그 (쉼표 구분)"
          value={tagsValue}
          onChange={e =>
            onTagsChange(
              e.target.value
                .split(',')
                .map(t => t.trim())
                .filter(Boolean),
            )
          }
          className="w-full text-sm p-2 rounded-lg bg-[#f0e6c0] border border-[#8b7a52]/40 text-[#2d5a27] placeholder-[#8b7a52]/60 focus:outline-none focus:border-[#2d5a27]"
        />
      </div>
    </div>
  )
}
