import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { MAX_PHOTOS } from '../model/usePhotoManager'

interface PhotoUploadZoneProps {
  onFiles: (files: FileList | File[]) => void
}

/**
 * 드래그앤드롭 + 파일 선택 업로드 영역.
 * 원본 story-forest 와 동일한 border-4 dashed + 중앙 UploadCloud 아이콘 스타일.
 */
export function PhotoUploadZone({ onFiles }: PhotoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) onFiles(e.target.files)
      // 같은 파일 재업로드 가능하도록 리셋 (원본 동작)
      if (inputRef.current) inputRef.current.value = ''
    },
    [onFiles],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
    },
    [onFiles],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`block w-full rounded-[2rem] p-8 text-center cursor-pointer mb-10 transition-colors border-4 border-dashed ${
        isDragOver
          ? 'bg-[#e8ddb4] border-[#2d5a27] shadow-[0_0_20px_rgba(180,220,140,0.4)]'
          : 'bg-[#f0e6c0] border-[#b4dc8c] hover:bg-[#e8ddb4]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c]">
        <UploadCloud className="w-8 h-8 text-[#f0e6c0]" />
      </div>
      <p className="text-xl text-[#2d5a27] mb-1 font-bold">
        이곳에 사진을 끌어다 놓거나 클릭해서 찾기
      </p>
      <p className="text-[#8b7a52] text-sm">최대 {MAX_PHOTOS}장 (JPG, PNG)</p>
    </label>
  )
}
