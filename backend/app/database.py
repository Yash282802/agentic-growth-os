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
    """Create tables with graceful error handling."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified successfully.")
        return True
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. App will start but DB features unavailable.")
        return False

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
