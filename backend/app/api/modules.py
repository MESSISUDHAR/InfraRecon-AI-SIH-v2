from fastapi import APIRouter
from app.schemas.common import ApiResponse

matches_router = APIRouter(prefix="/matches", tags=["Reconciliation Matches"])

@matches_router.get("/status")
def matches_status():
    return ApiResponse(
        success=True,
        message="Context-aware reconciliation service operational.",
        data={"milestone": 6}
    )

review_router = APIRouter(prefix="/review", tags=["Planner Review"])

@review_router.get("/status")
def review_status():
    return ApiResponse(
        success=True,
        message="Human-in-the-loop planner review service operational.",
        data={"milestone": 9}
    )

state_router = APIRouter(prefix="/execution-state", tags=["Verified Execution State"])

@state_router.get("/status")
def state_status():
    return ApiResponse(
        success=True,
        message="Verified execution state manager operational.",
        data={"milestone": 10}
    )

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])

@dashboard_router.get("/status")
def dashboard_status():
    return ApiResponse(
        success=True,
        message="Dashboard and progress analytics operational.",
        data={"milestone": 12}
    )

audit_router = APIRouter(prefix="/audit", tags=["Evidence & Audit Trail"])

@audit_router.get("/status")
def audit_status():
    return ApiResponse(
        success=True,
        message="Audit trail and explainability logger operational.",
        data={"milestone": 11}
    )
