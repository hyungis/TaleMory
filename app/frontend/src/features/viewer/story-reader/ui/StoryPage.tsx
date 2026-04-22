import { forwardRef, type ReactNode } from 'react'

interface StoryPageProps {
  className?: string
  children?: ReactNode
}

/**
 * react-pageflip 은 자식에 ref 를 꽂을 수 있는 DOM 엘리먼트를 요구한다.
 * 이 wrapper 가 페이지 한 장의 공통 shell 역할.
 */
export const StoryPage = forwardRef<HTMLDivElement, StoryPageProps>(function StoryPage(
  { className = '', children },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`viewer-page bg-[#f0e6c0] border-2 border-[#8b7a52]/60 p-8 overflow-hidden ${className}`}
    >
      {children}
    </div>
  )
})
