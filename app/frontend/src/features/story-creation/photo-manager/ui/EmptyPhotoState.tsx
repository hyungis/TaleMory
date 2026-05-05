import { ImageOff } from 'lucide-react'

/**
 * 업로드된 사진이 하나도 없을 때 리스트 영역에 표시하는 empty state — paper-craft 톤.
 */
export function EmptyPhotoState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '36px 16px',
        background: '#fbf2da',
        borderRadius: 16,
        border: '2px dashed var(--cr-caramel)',
        color: 'var(--cr-ink-soft)',
        fontFamily: 'var(--cr-font-gaegu)',
        fontSize: 18,
      }}
    >
      <ImageOff
        className="w-10 h-10 mx-auto mb-2"
        style={{ color: 'var(--cr-caramel-deep)', opacity: 0.5 }}
      />
      <p style={{ margin: 0 }}>아직 업로드된 사진이 없어요</p>
    </div>
  )
}
