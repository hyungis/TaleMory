# AI Server

FastAPI 기반 AI 기능 서버입니다.

## Setup

```powershell
cd app/ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

## Run

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Dockerfile 호환을 위해 `uvicorn main:app ...` 진입점도 동작합니다.

## Endpoints

- `GET /`: 서버 실행 상태 메시지
- `GET /health`: 헬스 체크
- `GET /docs`: Swagger UI

## Project Structure

```text
app/ai
├─ main.py
├─ requirements.txt
├─ requirements-dev.txt
├─ app
│  ├─ main.py
│  ├─ api
│  │  ├─ router.py
│  │  └─ routes
│  │     ├─ health.py
│  │     └─ root.py
│  ├─ core
│  │  └─ config.py
│  └─ schemas
│     └─ health.py
└─ tests
   └─ test_health.py
```

### 루트 파일

- `main.py`: Dockerfile의 기존 실행 명령인 `uvicorn main:app`을 유지하기 위한 호환용 진입점입니다. 실제 FastAPI 앱은 `app/main.py`에서 생성합니다.
- `requirements.txt`: 운영 실행에 필요한 Python 패키지 목록입니다.
- `requirements-dev.txt`: 테스트 등 개발 환경에서만 필요한 Python 패키지 목록입니다.

### app 패키지

- `app/main.py`: FastAPI 앱을 생성하고 전체 라우터를 등록하는 메인 파일입니다.
- `app/api/router.py`: 기능별 라우터를 하나로 묶는 파일입니다. 새 API 라우터를 만들면 이 파일에 등록합니다.
- `app/api/routes/`: 실제 HTTP 엔드포인트를 정의하는 폴더입니다. 예를 들어 `root.py`는 `/`, `health.py`는 `/health`를 담당합니다.
- `app/core/config.py`: 프로젝트 이름, 버전, 실행 환경 등 전역 설정을 관리합니다. 나중에 API Key, 모델명, 외부 서버 주소 같은 설정도 이곳에 추가합니다.
- `app/schemas/`: 요청/응답 데이터 모델을 정의하는 폴더입니다. FastAPI의 문서화와 응답 검증에 사용됩니다.

### tests

- `tests/`: API가 정상 동작하는지 확인하는 테스트 코드 폴더입니다.

### __init__.py 파일

각 폴더의 `__init__.py`는 해당 폴더를 Python 패키지로 인식시키기 위한 파일입니다. 덕분에 `from app.api.router import api_router`처럼 안정적으로 import할 수 있습니다. 대부분은 비워두거나 짧은 설명만 적어둡니다.

### 새 기능 추가 예시

채팅 API를 추가한다면 보통 아래처럼 파일을 늘립니다.

```text
app/api/routes/chat.py
app/schemas/chat.py
app/services/chat_service.py
```

그리고 `app/api/router.py`에서 새 라우터를 등록합니다.

## Test

```powershell
pytest
```

## Docker

```powershell
docker build -t s210-ai app/ai
docker run --rm -p 8000:8000 s210-ai
```

## Preview TTS

`POST /api/v1/voices/{voiceId}/preview` requires a reachable CosyVoice endpoint.

```powershell
$env:COSYVOICE_BASE_URL="http://localhost:9880"
$env:COSYVOICE_INSTRUCT_PATH="/inference_instruct2"
$env:COSYVOICE_TIMEOUT_SEC="60"
```

The preview API reads the stored `reference.wav`, builds an instruction from the request, calls CosyVoice, and stores the returned audio under `TTS_STORAGE_ROOT`.
