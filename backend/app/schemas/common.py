from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime

class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str
    environment: str
    database_connected: bool
    version: str = "1.0.0"
    timestamp: datetime

class ApiResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"
    data: Optional[Any] = None
    error: Optional[str] = None

class ProjectCreate(BaseModel):
    id: str = Field(..., description="Unique project slug/id")
    name: str = Field(..., description="Project name")
    code: str = Field(..., description="Short project code")
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    active_schedule_version: str
    data_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
