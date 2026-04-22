import { ImageOff } from 'lucide-react'

/**
 * 업로드된 사진이 하나도 없을 때 리스트 영역에 표시하는 empty state.
 */
export function EmptyPhotoState() {
  return (
    <div className="text-center text-[#b4c4a4] py-12 bg-[#2a1b12]/40 rounded-2xl border-2 border-dashed border-[#4a3a24]">
      <ImageOff className="w-12 h-12 mx-auto mb-2 opacity-60" />
      <p>아직 업로드된 사진이 없어요</p>
    </div>
  )
}
