import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { MAX_PHOTOS } from '../model/usePhotoManager'

interface PhotoUploadZoneProps {
  currentCount: number
  onFiles: (files: FileList | File[]) => void
}

/**
 * 드래그앤드롭 + 파일 선택 영역.
 */
export function PhotoUploadZone({ currentCount, onFiles }: PhotoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const remaining = MAX_PHOTOS - currentCount

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) onFiles(e.target.files)
      if (inputRef.current) inputRef.current.value = ''
    },
    [onFiles],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
    },
    [onFiles],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
        isDragOver
          ? 'border-[#2d5a27] bg-[#b4dc8c]/20'
          : 'border-[#8b7a52]/60 bg-[#e8ddb4] hover:border-[#2d5a27]'
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
      <ImagePlus className="w-10 h-10 mx-auto mb-3 text-[#2d5a27]" />
      <p className="text-[#2d5a27] text-lg font-bold mb-1">사진을 드래그하거나 클릭해서 추가</p>
      <p className="text-sm text-[#8b7a52]">
        JPG / PNG · 최대 {MAX_PHOTOS}장 · 현재 {currentCount}장 ({remaining}장 더 추가 가능)
      </p>
    </div>
  )
}
