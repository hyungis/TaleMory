import { useEffect } from 'react'
import { Camera } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { usePhotoManager } from '../model/usePhotoManager'
import { PhotoUploadZone } from './PhotoUploadZone'
import { PhotoItem } from './PhotoItem'

interface PhotoManagerStepProps {
  data: ProjectData['step2']
  onUpdate: <K extends keyof ProjectData['step2']>(key: K, value: ProjectData['step2'][K]) => void
  onBack: () => void
  onNext: () => void
}

const QUICK_TAGS = ['바다에서 놀기', '가족 사진', '맛있는 음식', '처음 본 풍경']

/**
 * STEP 02 — 사진 업로드 + 스토리 방향 프롬프트.
 *
 * 현재는 photos state 를 로컬 훅(usePhotoManager)으로 관리. onUpdate 로 동기화.
 * 실제 S3 업로드 / prompt AI 전달은 후속 API 연동 커밋에서.
 */
export function PhotoManagerStep({ data, onUpdate, onBack, onNext }: PhotoManagerStepProps) {
  const pm = usePhotoManager(data.photos)

  // photos 변경 시 상위 projectData.step2.photos 로 동기화
  useEffect(() => {
    onUpdate('photos', pm.photos)
    // onUpdate 는 dep 에 넣으면 무한루프 (함수 레퍼런스 바뀜) — photos 만 감시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pm.photos])

  const appendPromptTag = (tag: string) => {
    const current = data.prompt.trim()
    const next = current ? `${current} ${tag}` : tag
    onUpdate('prompt', next)
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={2} stepTitle="사진 업로드 & 스토리 방향" onBack={onBack} />

      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Camera className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#2d5a27] font-bold">여행 사진과 느낀 점을 알려주세요</h2>
              <p className="text-[#8b7a52] mt-2">AI 가 사진을 바탕으로 동화의 장면을 만들어요.</p>
            </div>

            <div className="space-y-8">
              {/* 업로드 존 */}
              <PhotoUploadZone currentCount={pm.photos.length} onFiles={pm.addFiles} />

              {/* 업로드된 사진 그리드 */}
              {pm.photos.length > 0 && (
                <div>
                  <h3 className="text-[#2d5a27] text-lg mb-3 font-bold">
                    업로드한 사진 ({pm.photos.length}장)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {pm.photos.map(photo => (
                      <PhotoItem
                        key={photo.id}
                        photo={photo}
                        onRemove={() => pm.removePhoto(photo.id)}
                        onTagsChange={tags => pm.updatePhoto(photo.id, { tags })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 프롬프트 */}
              <div>
                <label className="block text-[#2d5a27] text-lg mb-2 font-bold">
                  어떤 이야기로 만들고 싶어요? (선택)
                </label>
                <textarea
                  value={data.prompt}
                  onChange={e => onUpdate('prompt', e.target.value)}
                  placeholder="예: 아이가 처음으로 바다를 본 설렘을 담고 싶어요"
                  rows={4}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-[#2d5a27] placeholder-[#8b7a52]/60 resize-none"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUICK_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => appendPromptTag(tag)}
                      className="px-3 py-1.5 bg-[#e8ddb4] border border-[#8b7a52]/50 rounded-full text-sm text-[#2d5a27] hover:bg-[#2d5a27] hover:text-[#f0e6c0] hover:border-[#2d5a27] transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <NextButton onClick={onNext}>스토리 만들러 가기</NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}
