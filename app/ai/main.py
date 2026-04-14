from fastapi import FastAPI


app = FastAPI(title="AI API")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "AI FastAPI server is running"}


@app.get("/health")
def read_health() -> dict[str, str]:
    return {"status": "ok"}
