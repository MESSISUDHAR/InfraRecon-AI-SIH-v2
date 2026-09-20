from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base

class Activity(Base):
    __tablename__ = "activities"

    id = Column(String(100), primary_key=True, index=True) # UUID or composite key
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False, index=True)
    schedule_version = Column(String(50), default="v1.0", index=True)
    
    # WBS Hierarchy
    wbs_code = Column(String(100), index=True, nullable=True)
    wbs_name = Column(String(255), nullable=True)
    level = Column(String(10), default="L5") # e.g. L4, L5, L6
    
    # Activity Identifiers
    activity_id = Column(String(100), index=True, nullable=False) # e.g. PIP-L5-034
    activity_code = Column(String(100), nullable=True)
    activity_name = Column(Text, nullable=False)
    
    # Engineering & Spatial Metadata
    discipline = Column(String(100), index=True, nullable=True) # Piping, Civil, Electrical, etc.
    location = Column(String(200), index=True, nullable=True)   # Area PR-04, Zone 3, Block B
    asset_id = Column(String(100), index=True, nullable=True)   # Specific asset tag if any
    line_id = Column(String(100), index=True, nullable=True)    # Piping line number e.g. 24-XX
    
    # Schedule Parameters
    planned_start = Column(DateTime, nullable=True)
    planned_finish = Column(DateTime, nullable=True)
    planned_duration = Column(Float, nullable=True) # in days or hours
    planned_progress = Column(Float, default=0.0)   # 0 to 100%
    predecessor_ids = Column(Text, nullable=True)   # Comma-separated or JSON list of predecessor IDs
    
    # Vector Search & Semantic Text representation
    searchable_text = Column(Text, nullable=True)
    embedding = Column(Vector(384), nullable=True) # Native pgvector 384-dimensional dense vector
    embedding_json = Column(Text, nullable=True) # JSON array of floats for cross/backward compatibility
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="activities")
    candidates = relationship("MatchCandidate", back_populates="activity", cascade="all, delete-orphan")
    execution_state = relationship("ExecutionState", back_populates="activity", uselist=False, cascade="all, delete-orphan")
