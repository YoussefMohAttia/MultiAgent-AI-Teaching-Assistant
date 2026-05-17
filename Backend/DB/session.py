# backend/DB/session.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from Core.config import settings
from .schemas import Base        # ← this imports your real models from schemas.py

# Async engine (this is the only important change)
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    **({} if _is_sqlite else {"pool_size": 20, "max_overflow": 40})
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

# Dependency used in routers
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

# One-time function to create all tables (called from main.py)
async def create_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.DATABASE_URL.startswith("postgresql"):
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50)"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_jobs_enabled BOOLEAN DEFAULT TRUE"))
            await conn.execute(text("UPDATE users SET auth_provider = 'google' WHERE auth_provider IS NULL OR auth_provider = ''"))
            await conn.execute(text("ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'google'"))