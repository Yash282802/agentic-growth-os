import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

logger = logging.getLogger("database")

# Build engine with SSL for Postgres
connect_args = {}
engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 300}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs = {}
elif DATABASE_URL.startswith("postgresql"):
    # Supabase requires SSL
    if "sslmode" not in DATABASE_URL:
        if "?" in DATABASE_URL:
            DATABASE_URL += "&sslmode=require"
        else:
            DATABASE_URL += "?sslmode=require"

engine = create_engine(
    DATABASE_URL,
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
    """Add missing columns to existing tables using safe DO blocks."""
    from sqlalchemy import text as sql_text

    new_columns = {
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
    }

    try:
        conn = engine.connect()
        tx = conn.begin()
        for col_name, col_type in new_columns.items():
            sql = f"""DO $$
            BEGIN
                BEGIN
                    ALTER TABLE leads ADD COLUMN {col_name} {col_type};
                EXCEPTION WHEN duplicate_column THEN NULL;
            END;
            $$;"""
            conn.execute(sql_text(sql))
            logger.info(f"Ensured column leads.{col_name}")
        tx.commit()
        conn.close()
        logger.info("Migrations completed successfully.")
    except Exception as e:
        logger.warning(f"Migration error (non-fatal): {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
