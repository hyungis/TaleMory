import { useCallback, useEffect, useState } from 'react'
import { Image as ImageIcon, Wand2 } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { usePhotoManager, MAX_PHOTOS } from '../model/usePhotoManager'
import { PhotoUploadZone } from './PhotoUploadZone'
import { PhotoItem } from './PhotoItem'
import { EmptyPhotoState } from './EmptyPhotoState'
import { StoryPromptModal } from './StoryPromptModal'

interface PhotoManagerStepProps {
  data: ProjectData['step2']
  onUpdate: <K extends keyof ProjectData['step2']>(key: K, value: ProjectData['step2'][K]) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 02 — 추억 사진 선택 & 태깅.
 *
 * 구조:
 *  1. 업로드 존 (드래그앤드롭 + 클릭)
 *  2. 업로드된 사진 리스트 (썸네일 + 사진 설명(선택) + 태그(선택))
 *     · 사진 없을 때 EmptyPhotoState 로 대체
 *  3. 하단 액션 바: "이전 단계" / "스토리보드 만들기 ✨" (→ StoryPromptModal 오픈)
 *  4. StoryPromptModal: 장르/분위기 prompt + 3개 빠른 태그 + "마법 주문 적용!" → onNext()
 */
export function PhotoManagerStep({ data, onUpdate, onBack, onNext }: PhotoManagerStepProps) {
  const pm = usePhotoManager(data.photos)
  const [isPromptOpen, setIsPromptOpen] = useState(false)

  // photos 변경 시 상위 projectData.step2.photos 로 동기화
  useEffect(() => {
    onUpdate('photos', pm.photos)
    // onUpdate 는 dep 에 넣으면 무한루프 (함수 레퍼런스 바뀜) — photos 만 감시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pm.photos])

  const handleOpenPrompt = useCallback(() => setIsPromptOpen(true), [])
  const handleClosePrompt = useCallback(() => setIsPromptOpen(false), [])
  const handleApplyPrompt = useCallback(() => {
    setIsPromptOpen(false)
    onNext()
  }, [onNext])

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={2} stepTitle="추억 사진 선택 & 태깅" onBack={onBack} />

      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto pb-12">
            {/* 타이틀 영역 */}
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <ImageIcon className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#f0e6c0] font-bold">추억이 담긴 사진에 이야기를 달아주세요</h2>
              <p className="text-[#b4c4a4] mt-2">
                사진에 남긴 짧은 설명과 태그들이 모여 멋진 동화책의 뼈대가 됩니다.
              </p>
            </div>

            {/* 업로드 영역 */}
            <PhotoUploadZone onFiles={pm.addFiles} />

            {/* 업로드된 사진 리스트 */}
            <div className="space-y-4 mb-8">
              <h3 className="text-xl text-[#f0e6c0] border-b border-[#4a3a24] pb-2 font-bold flex justify-between items-center">
                <span>업로드된 사진</span>
                <span className="bg-[#2a1b12]/70 text-[#b4dc8c] px-3 py-1 rounded-full text-sm border border-[#b4dc8c]/50 font-sans shadow-sm">
                  {pm.photos.length} / {MAX_PHOTOS} 장
                </span>
              </h3>

              {pm.photos.length === 0 ? (
                <EmptyPhotoState />
              ) : (
                pm.photos.map(photo => (
                  <PhotoItem
                    key={photo.id}
                    photo={photo}
                    onRemove={() => pm.removePhoto(photo.id)}
                    onUpdate={patch => pm.updatePhoto(photo.id, patch)}
                  />
                ))
              )}
            </div>

            {/* 하단 액션 바 */}
            <div className="flex justify-between items-center pt-6 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-lg font-bold transition-colors"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={handleOpenPrompt}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap"
              >
                스토리보드 만들기 <Wand2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 스토리보드 마법 주문 모달 */}
      <StoryPromptModal
        isOpen={isPromptOpen}
        prompt={data.prompt}
        onPromptChange={value => onUpdate('prompt', value)}
        onClose={handleClosePrompt}
        onApply={handleApplyPrompt}
      />
    </div>
  )
}
