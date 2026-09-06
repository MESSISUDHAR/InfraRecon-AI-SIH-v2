from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class MatchCandidate(Base):
    __tablename__ = "match_candidates"

    id = Column(String(100), primary_key=True, index=True) # UUID
    event_id = Column(String(100), ForeignKey("execution_events.id"), nullable=False, index=True)
    activity_id = Column(String(100), ForeignKey("activities.id"), nullable=False, index=True)
    
    # Candidate Ranking & Match Details
    rank = Column(Integer, default=1) # 1 = Top candidate, 2 = 2nd, etc.
    is_top_match = Column(Boolean, default=False)
    
    # Individual Signal Scores (0.0 to 1.0)
    semantic_score = Column(Float, default=0.0)
    identifier_score = Column(Float, default=0.0)
    discipline_score = Column(Float, default=0.0)
    location_score = Column(Float, default=0.0)
    wbs_score = Column(Float, default=0.0)
    temporal_score = Column(Float, default=0.0)
    
    # Final Aggregate Confidence Score (0.0 to 1.0)
    final_confidence = Column(Float, default=0.0)
    
    # Explainable Reasoning & Signal Notes
    reasoning = Column(Text, nullable=True)
    conflicting_signals_json = Column(Text, nullable=True) # JSON list of signal flags
    
    # Workflow Status
    status = Column(String(50), default="pending_review") # auto_matched, pending_review, approved, rejected, overridden
    reviewer_id = Column(String(100), nullable=True)
    review_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    execution_event = relationship("ExecutionEvent", back_populates="candidates")
    activity = relationship("Activity", back_populates="candidates")
