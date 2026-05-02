import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { UploadCloud } from 'lucide-react'

interface PhotoUploadZoneProps {
  onFiles: (files: FileList | File[]) => void
  /** 업로드 영역 바닥의 메타 텍스트 (예: "최대 30장 · JPG, PNG · 한 장당 10MB 이하"). */
  metaText?: string
}

/**
 * paper-craft 톤 드래그앤드롭 + 파일 선택 업로드 영역.
 * `.cr-upload` 클래스로 dashed caramel border + cream background.
 */
export function PhotoUploadZone({
  onFiles,
  metaText = '최대 30장 · JPG, PNG · 한 장당 10MB 이하',
}: PhotoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) onFiles(e.target.files)
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
      className={`cr-upload${isDragOver ? ' is-dragover' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="cr-upload-icon">
        <UploadCloud className="w-7 h-7" />
      </div>
      <div className="cr-upload-text">이곳에 사진을 올려놓거나 클릭해서 찾기</div>
      <div className="cr-upload-meta">{metaText}</div>
    </label>
  )
}
