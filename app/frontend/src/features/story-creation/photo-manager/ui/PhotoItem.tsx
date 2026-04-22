import { Trash2, Image as ImageIcon } from 'lucide-react'
import type { PhotoItem as PhotoItemType } from '../../model/types'

interface PhotoItemProps {
  photo: PhotoItemType
  onRemove: () => void
  onUpdate: (patch: Partial<Pick<PhotoItemType, 'description' | 'tags'>>) => void
}

/**
 * 개별 사진 row.
 * 좌측 썸네일(정사각형) + 우측 "사진 설명(선택)" + "태그(선택)" 인풋 2개.
 * 삭제 버튼은 카드 hover 시에만 우상단에 페이드인.
 */
export function PhotoItem({ photo, onRemove, onUpdate }: PhotoItemProps) {
  return (
    <div className="bg-[#f0e6c0] p-4 md:p-6 rounded-2xl shadow-sm border-2 border-[#8b7a52]/60 hover:border-[#2d5a27] transition-colors flex flex-col md:flex-row gap-6 relative group">
      <button
        type="button"
        onClick={onRemove}
        title="사진 삭제"
        aria-label="사진 삭제"
        className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-[#8b3a2a] text-[#f0e6c0] border-2 border-[#c97b4a] opacity-0 group-hover:opacity-100 hover:bg-[#a84a35] hover:shadow-[0_0_10px_rgba(201,123,74,0.5)] transition-all z-10"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* 썸네일 */}
      <div className="w-full md:w-48 aspect-video md:aspect-square rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[#b4dc8c]/40 to-[#e8ddb4] flex items-center justify-center border border-[#8b7a52]/30">
        {photo.url ? (
          <img
            src={photo.url}
            alt={photo.name || '업로드 사진'}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <ImageIcon className="w-12 h-12 text-[#8b7a52] opacity-50" />
        )}
      </div>

      {/* 입력 필드 */}
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[#8b7a52] text-sm mb-1 font-bold">사진 설명 (선택)</label>
          <input
            type="text"
            placeholder="예: 해솔이가 처음으로 바다에 발을 담근 날"
            value={photo.description}
            onChange={e => onUpdate({ description: e.target.value })}
            className="w-full p-3 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-[#2d5a27] placeholder-[#8b7a52]/60"
          />
        </div>
        <div>
          <label className="block text-[#8b7a52] text-sm mb-1 font-bold">태그 (선택)</label>
          <input
            type="text"
            placeholder="예: #제주도 #여름휴가 #해솔이첫바다"
            value={photo.tags}
            onChange={e => onUpdate({ tags: e.target.value })}
            className="w-full p-3 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-[#2d5a27] placeholder-[#8b7a52]/60 font-bold"
          />
        </div>
      </div>
    </div>
  )
}
