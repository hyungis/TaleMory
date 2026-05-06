import { useCallback } from 'react'
import { ROUTES } from '../../../../shared/constants'

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID ?? ''
const KAKAO_SCOPE = 'account_email profile_nickname'

/**
 * 카카오 로그인 진입 버튼.
 * 현재 origin을 기준으로 Kakao authorize URL을 만들어 프론트 콜백으로 돌아오게 한다.
 */
export function KakaoOAuthButton() {
  const handleClick = useCallback(() => {
    const redirectUri = `${window.location.origin}${ROUTES.kakaoCallback}`
    const kakaoUrl = new URL(KAKAO_AUTHORIZE_URL)

    kakaoUrl.searchParams.set('client_id', KAKAO_CLIENT_ID)
    kakaoUrl.searchParams.set('redirect_uri', redirectUri)
    kakaoUrl.searchParams.set('response_type', 'code')
    kakaoUrl.searchParams.set('scope', KAKAO_SCOPE)

    window.location.assign(kakaoUrl.toString())
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
