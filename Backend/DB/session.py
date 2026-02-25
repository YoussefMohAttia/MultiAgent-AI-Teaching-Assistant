# backend/DB/session.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from Core.config import settings
from .schemas import Base        # ← this imports your real models from schemas.py

# Async engine (this is the only important change)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=40
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