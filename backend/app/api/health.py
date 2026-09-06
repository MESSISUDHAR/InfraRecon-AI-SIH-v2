from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db_connected = False
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    return HealthResponse(
        status="ok" if db_connected else "degraded",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database_connected=db_connected,
        version="1.0.0",
        timestamp=datetime.now(timezone.utc)
    )
