# AI Server

## Setup

```powershell
cd app/ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Docker

```powershell
docker build -t s210-ai app/ai
docker run --rm -p 8000:8000 s210-ai
```
