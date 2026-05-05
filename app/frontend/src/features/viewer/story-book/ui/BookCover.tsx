interface BookCoverProps {
  title: string
  illustrationUrl: string | null
}

/**
 * 동화책 앞표지 (단면). 책등은 부모에서 `.sb-spine` 으로 삽입.
 * 일러스트는 표지 전체에 full-bleed 로 깔리고, 그 위에 제목만 상단에 노출.
 * (예전 디자인에 있던 ✦ 배지 / 부제 / 저자 / 책장넘김 힌트 / 폴백 아이콘은 모두 제거)
 */
export function BookCover({ title, illustrationUrl }: BookCoverProps) {
  return (
    <div className="sb-cover-single">
      {illustrationUrl && (
        <img
          src={illustrationUrl}
          alt=""
          className="sb-cover-illust"
        />
      )}
      <h1 className="sb-cover-title">{title}</h1>
    </div>
  )
}
