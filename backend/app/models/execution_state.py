from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ExecutionState(Base):
    __tablename__ = "execution_states"

    id = Column(String(100), primary_key=True, index=True) # UUID or activity_id
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False, index=True)
    activity_id = Column(String(100), ForeignKey("activities.id"), nullable=False, unique=True, index=True)
    
    # Verified Actual Execution State
    actual_start = Column(DateTime, nullable=True)
    actual_finish = Column(DateTime, nullable=True)
    actual_progress = Column(Float, default=0.0) # 0 to 100%
    status = Column(String(50), default="Not Started") # Not Started, In Progress, Completed, Delayed
    
    # Variance & Delay Tracking
    delay_days = Column(Float, default=0.0)
    delay_reason = Column(Text, nullable=True)
    
    # Multi-Observation Lineage
    verified_observations_count = Column(Integer, default=0)
    last_event_id = Column(String(100), nullable=True)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    approval_state = Column(String(50), default="VERIFIED") # VERIFIED, PENDING_REVIEW, OVERRIDDEN

    # Relationships
    project = relationship("Project", back_populates="execution_states")
    activity = relationship("Activity", back_populates="execution_state")
