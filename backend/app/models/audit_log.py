from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(100), primary_key=True, index=True) # UUID
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False, index=True)
    event_id = Column(String(100), ForeignKey("execution_events.id"), nullable=True, index=True)
    activity_id = Column(String(100), nullable=True, index=True)
    
    # Action & Category
    action_type = Column(String(50), nullable=False) # EXTRACTION, AUTO_MATCH, PLANNER_APPROVAL, PLANNER_OVERRIDE, STATE_UPDATE, REJECTION
    decision_reason = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    performed_by = Column(String(100), default="SYSTEM_AI") # SYSTEM_AI, PLANNER_USER, etc.
    
    # State Snapshot Before & After (Audit Lineage)
    previous_state_json = Column(Text, nullable=True)
    new_state_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    project = relationship("Project", back_populates="audit_logs")
    execution_event = relationship("ExecutionEvent", back_populates="audit_logs")
