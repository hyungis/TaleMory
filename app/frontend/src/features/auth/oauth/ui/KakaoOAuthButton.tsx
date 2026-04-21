import { useCallback } from 'react'

interface KakaoOAuthButtonProps {
  onSuccess: () => void
}

/**
 * 카카오 로그인 진입 버튼.
 * 현재는 alert 후 onSuccess 호출 (UI 검증용 stub).
 * TODO(S14P31S210-75): 백엔드 OAuth 엔드포인트(`/api/auth/oauth/kakao`) 연동.
 */
export function KakaoOAuthButton({ onSuccess }: KakaoOAuthButtonProps) {
  const handleClick = useCallback(() => {
    // TODO(S14P31S210-75): 실제 카카오 OAuth 연동 (redirect or SDK)
    alert('카카오 로그인은 서버 연동 후 사용 가능합니다. 지금은 테스트로 통과시킬게요!')
    onSuccess()
  }, [onSuccess])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-[0_4px_0_#D4B900] hover:translate-y-1 hover:shadow-[0_2px_0_#D4B900] transition-all"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.86 5.2 4.68 6.55l-.96 3.52c-.1.36.29.65.59.45l4.18-2.78c.5.06 1 .09 1.51.09 5.52 0 10-3.48 10-7.83S17.52 3 12 3z" />
      </svg>
      카카오로 시작하기
    </button>
  )
}
