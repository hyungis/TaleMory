import { useCallback } from 'react'

/**
 * 카카오 로그인 진입 버튼.
 * 백엔드 authorize 엔드포인트로 이동해 OAuth 2.0 인가 코드를 받는 흐름을 시작한다.
 */
export function KakaoOAuthButton() {
  const handleClick = useCallback(() => {
    window.location.assign('/api/auth/oauth/kakao/authorize')
  }, [])

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
