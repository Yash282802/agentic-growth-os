import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL as DB_URL

logger = logging.getLogger("database")

# Build engine with SSL for Postgres
connect_args = {}
engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 300}

if DB_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs = {}
elif DB_URL.startswith("postgresql"):
    if "sslmode" not in DB_URL:
        if "?" in DB_URL:
            DB_URL += "&sslmode=require"
        else:
            DB_URL += "?sslmode=require"

engine = create_engine(
    DB_URL,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db():
    """Create tables and run migrations with graceful error handling."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified successfully.")
        _run_migrations()
        return True
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. App will start but DB features unavailable.")
        return False

def _run_migrations():
    """Add missing columns to existing tables."""
    from sqlalchemy import text as sql_text
    try:
        conn = engine.connect()
        for col_name, col_type in {
            "human_approved": "BOOLEAN DEFAULT FALSE",
            "prd_markdown": "TEXT",
            "stitch_prompt": "TEXT",
            "screen_list": "TEXT",
            "schema_sql": "TEXT",
            "endpoints": "TEXT",
            "repo_structure": "TEXT",
            "sections_needing_content": "TEXT",
            "github_repo_url": "TEXT",
            "preview_url": "TEXT",
            "outstanding_items": "TEXT",
        }.items():
            try:
                conn.execute(text(f"ALTER TABLE leads ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                logger.info(f"Added column leads.{col_name}")
            except Exception:
                conn.rollback()
        conn.close()
        logger.info("Migrations completed.")
    except Exception as e:
        logger.warning(f"Migration error (non-fatal): {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
