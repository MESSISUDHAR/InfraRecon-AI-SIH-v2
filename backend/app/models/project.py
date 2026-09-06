from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    active_schedule_version = Column(String(50), default="v1.0")
    data_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    activities = relationship("Activity", back_populates="project", cascade="all, delete-orphan")
    execution_events = relationship("ExecutionEvent", back_populates="project", cascade="all, delete-orphan")
    execution_states = relationship("ExecutionState", back_populates="project", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="project", cascade="all, delete-orphan")
