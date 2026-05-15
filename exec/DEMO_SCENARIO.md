# DEMO SCENARIO

본 문서는 `S14P31S210` (TaleMory) 시연 동선을 정리한다.
시연 이미지는 `exec/img/` 폴더에 추후 추가한다.

## 1. 시연 목표
- AI 동화 생성 파이프라인 전체 흐름 시연 (Step 1 → 9)
- 가족 사진 + 여행 메타로 만든 영어 동화책 결과물 감상 (뷰어: 책 모드 / 웹툰 모드)
- 음성 클로닝으로 만든 사용자 목소리로 동화 읽기
- 강조 문장 녹음 / 마무리 멘트 / 발행 / 공유 링크 흐름 데모

## 2. 시연 전 사전 준비
- 운영 서버 정상 기동 (`https://talemory.site` 200 OK)
- 시연 Kakao 계정 로그인 가능 상태
- 시연 가족 사진 5장 + 대표 표지 후보 사진 1장 준비
- voice clone 용 사용자 reference 녹음 1개 사전 등록 (선택 — 마이페이지에서 추가 가능)
- 메인 → 마이페이지 → 책장 / 작성 진입 가능 확인

## 3. 시연 동선 (화면 순서)

### STEP 1) 랜딩 진입
- 화면: `img/01_landing.png`
- 위치: `/` (HomePage)
- 조작: 3D 숲 씬에서 집/책장 입구 클릭 → 메인으로 진입

### STEP 2) 메인 화면 (책장 + 메뉴)
- 화면: `img/02_main.png`
- 위치: `/main` (MainShell + ForestScene)
- 조작: 우상단 메뉴 → "튜토리얼 보기" 가능 / 책장 진입

### STEP 3) Kakao 로그인 (미로그인 시)
- 화면: `img/03_kakao_login.png`
- 조작: "Kakao 로 시작하기" → Kakao OAuth → 콜백 → JWT 발급 → 메인 복귀

### STEP 4) 책장 모달 (BookshelfModal)
- 화면: `img/04_bookshelf.png`
- 조작: 발행된 동화책 목록 확인 → "새 동화 만들기" 클릭

### STEP 5) Step 1 — 기본 정보 (BasicInfoStep)
- 화면: `img/05_creation_step1.png`
- 위치: `/creation` (Step 1)
- 조작: 주인공 이름 + 함께한 사람 + 여행 일정 + 장소 입력 → 다음
- 모드 선택 모달: 일반 동화책 / **웹툰 모드** 선택 (StoryModeSelectModal)

### STEP 6) Step 2 — 사진 업로드
- 화면: `img/06_creation_step2.png`
- 위치: `/creation` (Step 2)
- 조작
  - 가족 멤버 사진 업로드 (인물 식별용)
  - 추억 사진 업로드 (스토리 소스)
  - 대표 표지 후보 1장 선택
- 비동기: presigned PUT 으로 S3 직접 업로드 → BE commit

### STEP 7) Step 3 — 줄거리 (Synopsis)
- 화면: `img/07_creation_step3.png`
- 조작: AI 가 생성한 줄거리 확인 → 수정 → 다음
- 비동기: BE → AI 워커 → OpenAI (gpt-5-nano) → synopsis 반환

### STEP 8) Step 4 — 스토리보드 편집
- 화면: `img/08_creation_step4.png`
- 조작: 페이지별 영문/한글 본문 + 라프 일러스트 확인 → 필요 시 페이지 단위 재생성
- 비동기: storyboard 본문 (gpt-4o-mini) + 라프 이미지 (Gemini Vision)

### STEP 9) Step 5 — 그림 스타일
- 화면: `img/09_creation_step5.png`
- 조작: 동화책 그림체 프리셋 선택 → 다음
- 효과: 선택 즉시 **FINAL_ILLUSTRATION 잡 발행** (백그라운드 일러스트 생성 시작)

### STEP 10) Step 6 — 목소리 준비 (Voice)
- 화면: `img/10_creation_step6.png`
- 조작
  - 마이페이지에 voice profile 이 있으면 선택
  - 신규: reference 녹음 (5초 이상) → 등록 → 선택
- 비동기: voice clone preview TTS 로 짧은 미리듣기 가능

### STEP 11) Step 7 — 하이라이트 / 마무리
- 화면: `img/11_creation_step7.png`
- 조작
  - 강조해서 읽을 문장 선택 → 사용자 직접 녹음 (presigned S3 업로드)
  - 마무리 멘트 텍스트 입력 + 음성 녹음 (선택)
- 효과: 문장별 `has_highlighted=true`, scene_highlight_voice row 생성

### STEP 12) Step 8 — 최종 미리보기
- 화면: `img/12_creation_step8.png`
- 조작
  - 완성된 동화 책 전체 흐름 확인 (final illustration + TTS)
  - 웹툰 모드: 말풍선 + 캐릭터 좌표 anchor 확인
  - 일러스트 재생성 (페이지 단위) 가능
- 비동기: 전 단계 동안 백그라운드에서 final illustration + TTS 잡 모두 도착해 있어야 정상 표시

### STEP 13) Step 9 — 동화 발행
- 화면: `img/13_creation_step9.png`
- 조작: "발행하기" 클릭 → confirmation → 책장으로 이동
- 효과: `Story.status=PUBLISHED`, `publishedAt` 기록, 공유 토큰(shareToken) 발급

### STEP 14) 책장에서 발행된 동화 확인
- 화면: `img/14_bookshelf_published.png`
- 위치: `/main` → BookshelfModal
- 조작: 발행된 동화 클릭 → 청첩장(InvitationCard) 진입

### STEP 15) 청첩장 (InvitationCard)
- 화면: `img/15_invitation.png`
- 위치: `/viewer/:storyId`
- 조작: 표지 + 동화 메타 + "동화책으로 보기" / "웹툰으로 보기" 선택

### STEP 16) 책 모드 뷰어 (StoryBookViewer)
- 화면: `img/16_book_viewer.png`
- 위치: `/viewer/:storyId?mode=book` (popup window)
- 조작
  - 좌/우 화살표로 페이지 넘기기
  - 좌측 도구: 음성 재생 / 일시정지 / 번역 토글 / 글자 크기 / 책갈피
  - 문장 클릭 → 해당 문장 음성 재생

### STEP 17) 웹툰 모드 뷰어 (StoryWebtoonViewer)
- 화면: `img/17_webtoon_viewer.png`
- 위치: `/viewer/:storyId?mode=webtoon` (popup window)
- 조작
  - 세로 스크롤로 페이지 진행
  - 말풍선이 캐릭터 anchor 좌표 기준으로 배치 (Gemini Vision 추출 결과)
  - 페이지별 [재생] 버튼으로 sentence 순차 음성 + 활성 sentence 강조

### STEP 18) 공유 링크
- 화면: `img/18_share.png`
- 위치: `/shared/:shareToken`
- 조작: 공유 토큰만 있으면 비로그인 사용자도 동화 감상 가능

### STEP 19) 마이페이지
- 화면: `img/19_mypage.png`
- 위치: `/mypage`
- 조작
  - 본인 프로필 확인
  - 가족 멤버 관리
  - voice profile 관리

### STEP 20) 보이스 클론 추가
- 화면: `img/20_voice_clone_add.png`
- 위치: `/mypage/voice-clone/add`
- 조작: reference 녹음 → 업로드 → preview TTS 로 결과 확인 → 저장

## 4. 비동기 잡 흐름 (시연 도중 설명 포인트)

| 단계 | 발행 잡 | 처리 워커 | 비고 |
|---|---|---|---|
| Step 4 → 5 | storyboard 생성 (`ai.cpu.story.generate`) | `ai-worker` | OpenAI gpt-4o-mini |
| Step 4 페이지 재생성 | storyboard image (`ai.image.regenerate`) | `ai-worker` | Gemini Vision |
| Step 5 진입 | FINAL_ILLUSTRATION batch (`ai.image.final-illustration.generate`) | `ai-worker` | Replicate FLUX / Gemini Vision |
| Step 5 완료 (WEBTOON) | LAYOUT batch (`ai.image.final-illustration.layout`) | `ai-worker` | Gemini Vision 좌표 추출 |
| Step 7 → 8 | TTS batch (`ai.gpu.tts.generate`) | `ai-tts-story-worker` | Qwen TTS server |
| voice clone preview | preview TTS (`ai.gpu.tts.preview`) | `ai-tts-preview-worker` | Qwen TTS server |

각 잡의 진행 상태는 `GET /api/jobs/{jobId}` 폴링으로 FE 가 추적. Redis 캐시로 응답 부담 완화.

## 5. 마무리 멘트 예시
- "TaleMory 는 가족 사진과 여행 추억을 AI 동화책으로 만들어 주는 서비스입니다."
- "OpenAI 가 본문을, Gemini Vision 이 일러스트와 캐릭터 좌표를, Qwen TTS 가 가족 목소리를 만들어 줍니다."
- "최종 결과물은 책 모드와 웹툰 모드 두 가지 뷰어로 감상하며, 공유 링크로 친구/가족과도 나눌 수 있습니다."

## 6. 시연 도중 트러블 시 대응

| 증상 | 즉시 대응 |
|---|---|
| Kakao 로그인 실패 | redirect URI 화이트리스트 + Kakao Developers 콘솔 확인. 사전 발급된 시연용 JWT 로 우회 가능 |
| 일러스트가 안 뜸 | RabbitMQ UI 에서 `ai.image.*` queue 의 consumer 수 + 백로그 확인 |
| TTS 가 안 들림 | Qwen 서버 상태 확인. nginx `/static/` 마운트 확인 (local 모드) / S3 키 확인 (s3 모드) |
| 웹툰 좌표가 fallback (top center) | Gemini Vision 좌표 추출 실패. 뷰어의 "좌표 다시 추출" 버튼 사용 |
| 발행 후 책장에 안 보임 | `Story.status=PUBLISHED` 확인. BE 로그에서 발행 API 응답 점검 |

## 7. 이미지 폴더 안내
시연용 스크린샷은 `exec/img/` 폴더 아래 위 STEP 번호와 일치하는 파일명 (`NN_<slug>.png`) 으로 저장한다. 추후 실제 시연 환경에서 캡처해 채울 예정.
