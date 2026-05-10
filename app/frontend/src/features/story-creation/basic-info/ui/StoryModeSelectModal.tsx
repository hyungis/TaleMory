import { BookOpen, MessageSquareText, X } from 'lucide-react'
import type { StoryModeApi } from '../api/types'

interface StoryModeSelectModalProps {
  /** 모드 선택 후 호출. 부모는 navigate(/creation, {state:{mode}}) 로 진입. */
  onSelect: (mode: StoryModeApi) => void
  /** 모달만 닫기 — ESC / overlay / X 버튼 / 취소. */
  onClose: () => void
}

/**
 * "새 동화책 만들기" 클릭 시 노출되는 동화 생성 모드 선택 모달.
 *
 * BookstoreScene 에서 사용자가 "새 동화책 만들기" 를 누르면 (그리고 진행 중인 DRAFT 가 없거나
 * "새로 시작하기" 로 폐기를 확정한 직후) 이 모달이 떠서 두 가지 모드 중 하나를 고르게 한다.
 *  - VIEWER (기본): 페이지별 narration 본문 — 기존 동화책 모드.
 *  - WEBTOON      : sentence 마다 화자 + 캐릭터 위치 메타 — 대화 중심 웹툰 모드.
 *
 * 선택된 mode 는 location.state 로 CreationPage 에 전달되고 useStoryCreationFlow 가
 * mount 시 한 번 결정 → BasicInfoStep 의 POST /api/stories body 에 그대로 실어 BE 영속화.
 *
 * 디자인은 DraftResumeModal 과 같은 paper-craft 톤을 유지해 시각적 일관성을 확보한다.
 */
export function StoryModeSelectModal({ onSelect, onClose }: StoryModeSelectModalProps) {
  return (
    <div
      className="fixed inset-0 z-[6000] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-[overlayFadeIn_0.18s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="동화 생성 모드 선택"
    >
      <div
        className="bg-[#F4E4BC] border-2 border-[#9A7548]/40 rounded-3xl shadow-[0_20px_60px_rgba(107,74,40,0.4)] max-w-md w-full p-6 sm:p-7 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* X 닫기 버튼 — 우상단. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#E9DBBE] hover:bg-[#D9BE82] border border-[#9A7548]/40 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-[#3E2A18]" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-2xl text-[#3E2A18] font-bold mb-1">어떤 동화로 만들까요?</h2>
          <p className="text-[#6B4A28] text-base leading-relaxed">
            아래 두 가지 모드 중 하나를 골라주세요. 한 번 시작하면 도중에 바꿀 수 없어요.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <ModeOptionButton
            mode="VIEWER"
            icon={<BookOpen className="w-5 h-5" />}
            title="기본 모드 (그림책)"
            description="페이지마다 한 단락의 이야기로 잔잔하게 읽어주는 동화책이에요."
            onSelect={onSelect}
          />
          <ModeOptionButton
            mode="WEBTOON"
            icon={<MessageSquareText className="w-5 h-5" />}
            title="웹툰 모드 (대화)"
            description="아이가 직접 등장인물이 되어 대사로 이야기가 흘러가는 웹툰형 동화예요."
            onSelect={onSelect}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#E9DBBE] text-[#3E2A18] px-4 py-2 rounded-full border-2 border-[#9A7548]/40 hover:bg-[#D9BE82] transition-colors font-bold text-base"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

interface ModeOptionButtonProps {
  mode: StoryModeApi
  icon: React.ReactNode
  title: string
  description: string
  onSelect: (mode: StoryModeApi) => void
}

/**
 * 모드 옵션 한 줄. 카드 전체가 클릭 영역 — 시각적으로 큰 hit-target 제공.
 * VIEWER / WEBTOON 두 카드는 동일한 톤이고, 선택 자체로 페이지 진입을 트리거하므로
 * 라디오 버튼 + 확인 버튼 같은 별도 단계를 두지 않는다.
 */
function ModeOptionButton({ mode, icon, title, description, onSelect }: ModeOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className="text-left bg-[#E9DBBE] border-2 border-[#9A7548]/30 rounded-2xl p-4 hover:bg-[#D9BE82] hover:border-[#9A7548]/60 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_2px_0_#9A7548]/30 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 bg-[#F4E4BC] rounded-full flex items-center justify-center border-2 border-[#9A7548]/40 text-[#3E2A18]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg text-[#3E2A18] font-bold mb-0.5">{title}</h3>
          <p className="text-[#6B4A28] text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}
