from sqlalchemy import Column, String, Float, Boolean
from app.database import Base

class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(String(100), primary_key=True, index=True)
    project_id = Column(String(50), index=True, nullable=False)
    predecessor_id = Column(String(100), index=True, nullable=False)
    successor_id = Column(String(100), index=True, nullable=False)
    dependency_type = Column(String(10), default="FS") # FS (Finish-to-Start), SS, FF, SF
    lag_days = Column(Float, default=0.0)
    is_critical_path = Column(Boolean, default=False)
