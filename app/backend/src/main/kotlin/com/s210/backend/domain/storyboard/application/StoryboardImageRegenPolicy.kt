package com.s210.backend.domain.storyboard.application

/**
 * 스토리보드 페이지 이미지 재생성 정책 상수.
 *
 * 한도/카운트 정의를 한 곳에 모아 두기 위한 object — 서비스 / API 응답 / 테스트가
 * 같은 정의를 공유하도록 보장한다.
 */
object StoryboardImageRegenPolicy {
    /**
     * 동화(스토리)당 페이지 이미지 재생성 잡 한도.
     *
     * - 카운트 대상: `JobType.STORYBOARD_IMAGE_REGENERATE` 의 `SUCCESS + FAILED` 합산.
     *   PENDING/RUNNING 은 제외하지만 race 방지를 위해 별도로 active job 체크가 들어간다.
     * - 시스템 실패(FAILED)도 비용/리소스 발생했으므로 정책상 함께 집계.
     * - 헤더 카운터 (`GET /storyboard/regen-status`) 와 한도 검사 (`regenerateOne`) 가 같은 값을 사용.
     */
    const val LIMIT_PER_STORY = 3
}
