from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api import (
    health_router,
    auth_router,
    projects_router,
    schedule_router,
    execution_router,
    matches_router,
    review_router,
    execution_state_router,
    state_router,
    dashboard_router,
    audit_router,
    dependencies_router,
    historical_memory_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    try:
        from app.database import SessionLocal
        from app.services.historical_memory_service import seed_demo_historical_memory
        with SessionLocal() as db:
            seed_demo_historical_memory(db)
    except Exception:
        pass
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Planning-to-Execution Intelligence Layer for Infrastructure Project Management (SIH 2026 - PS 26122)",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Health & Info endpoints
app.include_router(health_router)

# API v1 Namespaced Endpoints
app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(execution_router, prefix="/api")
app.include_router(matches_router, prefix="/api")
app.include_router(review_router, prefix="/api")
app.include_router(execution_state_router, prefix="/api")
app.include_router(state_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(dependencies_router, prefix="/api")
app.include_router(historical_memory_router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }
