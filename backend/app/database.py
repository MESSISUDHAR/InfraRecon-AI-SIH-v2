from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Database engine configuration (supports SQLite and PostgreSQL seamlessly)
database_url = settings.DATABASE_URL
connect_args = {}

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    database_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Import all models to register with metadata
    from app.models import (
        project,
        activity,
        execution_event,
        match_candidate,
        execution_state,
        dependency,
        audit_log,
        user
    )
    Base.metadata.create_all(bind=engine)

    # Safe lightweight schema synchronization for development and SQLite
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "execution_events" in inspector.get_table_names():
            existing_cols = {col["name"] for col in inspector.get_columns("execution_events")}
            with engine.begin() as conn:
                if "source_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN source_id VARCHAR(100)"))
                if "reporter_name" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN reporter_name VARCHAR(100)"))
                if "report_date" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN report_date DATETIME"))
    except Exception:
        pass

