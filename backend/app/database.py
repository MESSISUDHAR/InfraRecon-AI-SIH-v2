from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Database engine configuration (supports SQLite and PostgreSQL seamlessly)
database_url = settings.DATABASE_URL
engine_kwargs = {"echo": False}

if database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif database_url.startswith("postgresql") or database_url.startswith("postgres"):
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30
    })

engine = create_engine(
    database_url,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def is_postgresql() -> bool:
    """Returns True if the active database dialect is PostgreSQL."""
    return engine.dialect.name == "postgresql"

def init_db():
    # 1. Enable pgvector extension if running on PostgreSQL
    if is_postgresql():
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception as e:
            # Fallback or log if extension creation requires specific permissions
            pass

    # 2. Import all models to register with metadata
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

    # 3. Safe lightweight schema synchronization
    try:
        inspector = inspect(engine)
        if "execution_events" in inspector.get_table_names():
            existing_cols = {col["name"] for col in inspector.get_columns("execution_events")}
            with engine.begin() as conn:
                if "source_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN source_id VARCHAR(100)"))
                if "reporter_name" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN reporter_name VARCHAR(100)"))
                if "report_date" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN report_date TIMESTAMP" if is_postgresql() else "ALTER TABLE execution_events ADD COLUMN report_date DATETIME"))
                if "embedding" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN embedding VECTOR(384)"))
                if "embedding_json" not in existing_cols:
                    conn.execute(text("ALTER TABLE execution_events ADD COLUMN embedding_json TEXT"))
        
        if "activities" in inspector.get_table_names():
            existing_act_cols = {col["name"] for col in inspector.get_columns("activities")}
            with engine.begin() as conn:
                if "embedding" not in existing_act_cols:
                    conn.execute(text("ALTER TABLE activities ADD COLUMN embedding VECTOR(384)"))
                if "embedding_json" not in existing_act_cols:
                    conn.execute(text("ALTER TABLE activities ADD COLUMN embedding_json TEXT"))

        # Create pgvector HNSW index for fast approximate nearest neighbor search if PostgreSQL
        if is_postgresql():
            with engine.begin() as conn:
                try:
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_activities_embedding_hnsw ON activities USING hnsw (embedding vector_cosine_ops);"))
                except Exception:
                    pass

        # Seed standard demo accounts if not existing
        from app.models.user import User
        from app.services.auth_service import hash_password
        with SessionLocal() as db:
            demo_accounts = [
                {
                    "id": "USR-DEMO-SUP",
                    "full_name": "Vikram Sharma (Supervisor)",
                    "email": "supervisor@infra-project.com",
                    "role": "Site Supervisor",
                    "password_hash": hash_password("demo_password123")
                },
                {
                    "id": "USR-DEMO-PLN",
                    "full_name": "Anita Patel (Planner)",
                    "email": "planner@infra-project.com",
                    "role": "Construction Planner",
                    "password_hash": hash_password("demo_password123")
                },
                {
                    "id": "USR-DEMO-DIR",
                    "full_name": "Rajesh Kumar (Director)",
                    "email": "director@infra-project.com",
                    "role": "Project Director",
                    "password_hash": hash_password("demo_password123")
                }
            ]
            for acc in demo_accounts:
                existing = db.query(User).filter(User.email == acc["email"]).first()
                if not existing:
                    user_obj = User(
                        id=acc["id"],
                        full_name=acc["full_name"],
                        email=acc["email"],
                        role=acc["role"],
                        password_hash=acc["password_hash"],
                        is_active=True
                    )
                    db.add(user_obj)
            db.commit()
    except Exception:
        pass
