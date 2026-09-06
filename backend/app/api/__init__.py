from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.schedule import router as schedule_router
from app.api.execution import router as execution_router
from app.api.matches import router as matches_router
from app.api.review import router as review_router
from app.api.execution_state import router as execution_state_router
from app.api.dashboard import router as dashboard_router
from app.api.audit import router as audit_router
from app.api.dependencies import router as dependencies_router
from app.api.modules import (
    state_router
)

__all__ = [
    "health_router",
    "projects_router",
    "schedule_router",
    "execution_router",
    "matches_router",
    "review_router",
    "execution_state_router",
    "state_router",
    "dashboard_router",
    "audit_router",
    "dependencies_router"
]


