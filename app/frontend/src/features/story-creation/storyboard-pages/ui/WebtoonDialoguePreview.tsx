import { MessageCircle, MessageSquareText, Users } from 'lucide-react'
import type { StoryboardSentenceItem, WebtoonCharacterInScene } from '../api/types'

const KOREAN_TEXT_STYLE = {
  fontFamily: "'Gaegu', 'Nanum Pen Script', cursive",
  fontWeight: 700,
  letterSpacing: 0,
} as const

interface WebtoonDialoguePreviewProps {
  /**
   * BE 응답의 sentences. 각 원소가 type/speakerKey 를 갖고 있을 때만 webtoon 모드로 인식.
   * VIEWER 모드 (또는 옛 데이터) 라면 두 필드 미존재 → 컴포넌트가 자체적으로 null 렌더 처리.
   */
  sentences: StoryboardSentenceItem[] | null | undefined
  /** 페이지에 등장하는 캐릭터 메타. WEBTOON 모드 한정. 비어있으면 캐릭터 헤더 미표시. */
  charactersInScene?: WebtoonCharacterInScene[] | null
  /** 한국어/영어 중 어느 본문을 노출할지. 기본 'ko'. */
  textLang?: 'ko' | 'en'
}

/**
 * WEBTOON 모드 페이지의 sentence 별 화자/대사 시각화 (read-only 미리보기).
 *
 * 사용 시점: Step 4 storyboard editor 의 단일 페이지 뷰 등에서 textarea 옆/아래에 노출.
 * 사용자는 textarea 로 본문을 통째로 편집하지만 이 컴포넌트는 "AI 가 의도한 화자/대사 흐름"
 * 을 그대로 보여줘서 누가 어떤 말을 했는지 한 눈에 파악 가능.
 *
 * 분기:
 *  - sentence.type === 'DIALOGUE' → 말풍선 카드 + 화자 라벨 (speakerKey).
 *  - sentence.type === 'NARRATION' → 옅은 italic 나레이션 카드.
 *  - sentence.type 이 모두 null/undefined → 컴포넌트 전체 null (VIEWER 모드 안전 폴백).
 *
 * 디자인은 storyboard-editor 의 paper-craft 톤(#f0e6c0 / #2d5a27 / #8b7a52) 를 따른다.
 */
export function WebtoonDialoguePreview({
  sentences,
  charactersInScene,
  textLang = 'ko',
}: WebtoonDialoguePreviewProps) {
  if (!sentences || sentences.length === 0) return null
  // VIEWER 모드 호환: sentence 가 type 을 전혀 안 가지면 (= 옛 row 또는 VIEWER) 자체 null.
  const hasWebtoonMeta = sentences.some(s => s.type === 'DIALOGUE' || s.type === 'NARRATION')
  if (!hasWebtoonMeta) return null

  return (
    <div className="bg-[#fff9dd] border-2 border-[#b4dc8c] rounded-3xl p-5 md:p-6 shadow-sm">
      {/* 헤더 — 페이지 등장 캐릭터 (있을 때만) */}
      {charactersInScene && charactersInScene.length > 0 && (
        <CharactersInSceneHeader characters={charactersInScene} />
      )}

      <div className="flex flex-col gap-3">
        {sentences.map(sentence => (
          <SentenceLine key={sentence.sentenceOrder} sentence={sentence} textLang={textLang} />
        ))}
      </div>
    </div>
  )
}

interface CharactersInSceneHeaderProps {
  characters: WebtoonCharacterInScene[]
}

function CharactersInSceneHeader({ characters }: CharactersInSceneHeaderProps) {
  return (
    <div className="flex items-start gap-2 mb-4 pb-3 border-b-2 border-dashed border-[#b4dc8c]/60">
      <Users className="w-5 h-5 text-[#2d5a27] mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex flex-wrap gap-1.5 text-base">
        {characters.map(c => (
          <span
            key={c.characterKey}
            className="inline-flex items-baseline gap-1 bg-[#e8ddb4] text-[#2d5a27] px-3 py-1 rounded-full border border-[#8b7a52]/40 font-bold"
            title={`${c.sceneRole} (${c.expectedPosition})`}
          >
            {c.characterKey}
            <span className="text-xs text-[#8b7a52] font-normal">· {c.expectedPosition}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface SentenceLineProps {
  sentence: StoryboardSentenceItem
  textLang: 'ko' | 'en'
}

function SentenceLine({ sentence, textLang }: SentenceLineProps) {
  const text = textLang === 'ko' ? sentence.koreanText : sentence.englishText
  const isDialogue = sentence.type === 'DIALOGUE'
  const speaker = sentence.speakerKey
  const textStyle = textLang === 'ko' ? KOREAN_TEXT_STYLE : undefined

  if (isDialogue) {
    return (
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#2d5a27] text-[#b4dc8c] px-3 py-0.5 rounded-full text-sm font-bold border border-[#b4dc8c]/40 mt-0.5">
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          {speaker ?? '?'}
        </span>
        <p className="flex-1 text-[#2d5a27] text-lg leading-relaxed" style={textStyle}>
          {text}
        </p>
      </div>
    )
  }

  // NARRATION
  return (
    <div className="flex items-start gap-2.5 opacity-90">
      <span className="shrink-0 inline-flex items-center gap-1 bg-[#e8ddb4] text-[#8b7a52] px-3 py-0.5 rounded-full text-sm font-bold border border-[#8b7a52]/40 mt-0.5">
        <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
        나레이션
      </span>
      <p className="flex-1 text-[#8b7a52] italic text-base leading-relaxed" style={textStyle}>
        {text}
      </p>
    </div>
  )
}
