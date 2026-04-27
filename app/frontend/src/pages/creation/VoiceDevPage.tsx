import { useCallback, useState } from 'react'
import { VoiceCloneStep } from '../../features/story-creation'
import '../../features/bookshelf/styles/bookshelf.css'

/**
 * DEV ONLY — Step 6 (보이스 클로닝) 단독 확인용 페이지.
 * /creation/voice 에서 접근. 작업 완료 후 제거할 것.
 */
export function VoiceDevPage() {
  const [voiceModel, setVoiceModel] = useState<string | null>(null)

  const handleBack = useCallback(() => {
    window.history.back()
  }, [])

  const handleNext = useCallback(() => {
    alert('다음 단계로 이동 (DevPage 에서는 동작 없음)')
  }, [])

  const handleVoiceSaved = useCallback((model: string) => {
    setVoiceModel(model)
    console.log('[VoiceDevPage] voice saved:', model)
  }, [])

  return (
    <div className="relative w-full h-full">
      {voiceModel && (
        <div className="fixed top-4 right-4 z-50 bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
          저장된 보이스: {voiceModel}
        </div>
      )}
      <VoiceCloneStep
        onBack={handleBack}
        onNext={handleNext}
        onVoiceSaved={handleVoiceSaved}
      />
    </div>
  )
}
