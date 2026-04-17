from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(tags=["root"])


@router.get("/")
def read_root() -> dict[str, str]:
    return {"message": f"{settings.PROJECT_NAME} is running"}
