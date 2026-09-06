from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ExecutionEvent(Base):
    __tablename__ = "execution_events"

    id = Column(String(100), primary_key=True, index=True) # UUID
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False, index=True)
    source_id = Column(String(100), index=True, nullable=True) # e.g. DPR-2026-09-05-01
    source_type = Column(String(50), default="DPR_TEXT") # DPR_TEXT, FILE_UPLOAD, CSV_BATCH, SITE_DIARY, SUPERVISOR_LOG
    source_reference = Column(String(255), nullable=True) # Filename or report document reference
    reporter_name = Column(String(100), nullable=True) # Supervisor / Engineer name
    report_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Raw Immutable Evidence
    raw_text = Column(Text, nullable=False)
    
    # Structured Extracted Fields (Populated in Milestone 4 via Gemini 2.5 Flash)
    activity_description = Column(Text, nullable=True)
    discipline = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    asset_id = Column(String(100), nullable=True)
    line_id = Column(String(100), nullable=True)
    event_type = Column(String(50), default="progress") # progress, completion, delay, inspection, milestone
    
    # Reported Progress & Temporal Data
    actual_start = Column(DateTime, nullable=True)
    actual_finish = Column(DateTime, nullable=True)
    event_progress = Column(Float, nullable=True) # 0 to 100%
    status = Column(String(50), default="INGESTED") # INGESTED, EXTRACTED, PENDING_REVIEW, APPROVED, REJECTED
    delay_reason = Column(Text, nullable=True)
    evidence_text = Column(Text, nullable=True) # Exact verbatim quote grounding the extraction
    extraction_confidence = Column(Float, default=1.0) # Extraction confidence from LLM
    
    # Metadata & Tracking
    model_version = Column(String(50), default="gemini-2.5-flash")
    prompt_version = Column(String(50), default="v1.0")
    embedding_json = Column(Text, nullable=True) # Vector representation of extracted activity description
    ingestion_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="execution_events")
    candidates = relationship("MatchCandidate", back_populates="execution_event", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="execution_event", cascade="all, delete-orphan")
