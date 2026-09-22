"""MongoDB Asynchronous Client & Lifecycle Management.

Manages connection pooling, lifecycle hooks (connect, ping, disconnect),
and declarative index initialization using the Motor async driver.
"""

import logging
import time
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
import pymongo

from app.config import get_settings

logger = logging.getLogger("taskpilot.database")


class MongoDBManager:
    """Encapsulates async MongoDB connection state and lifecycle hooks."""

    def __init__(self) -> None:
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None

    async def connect(self) -> None:
        """Initialize Motor client connection pool and bind target database."""
        settings = get_settings()
        logger.info("Initializing MongoDB connection to %s", settings.MONGO_URI.split("@")[-1])

        self.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            minPoolSize=settings.MONGO_MIN_POOL_SIZE,
            maxPoolSize=settings.MONGO_MAX_POOL_SIZE,
            serverSelectionTimeoutMS=5000,
            uuidRepresentation="standard",
        )
        # Determine target database: prefer default db embedded in MONGO_URI if present, else MONGO_DB_NAME
        try:
            default_db = self.client.get_default_database()
            self.db = default_db if default_db is not None else self.client[settings.MONGO_DB_NAME]
        except Exception:
            self.db = self.client[settings.MONGO_DB_NAME]

    async def ping(self) -> Dict[str, Any]:
        """Execute a round-trip ping command to verify database availability.

        Returns:
            dict: Ping status metadata including round-trip latency in milliseconds.

        Raises:
            ConnectionError: When the database client is uninitialized or unreachable.
        """
        if self.client is None or self.db is None:
            raise ConnectionError("MongoDB client is not initialized.")

        start_time = time.perf_counter()
        try:
            # Issue admin command ping
            await self.client.admin.command("ping")
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info("MongoDB ping successful (latency: %s ms)", latency_ms)
            return {
                "status": "connected",
                "database": self.db.name,
                "latency_ms": latency_ms,
            }
        except Exception as exc:
            logger.error("MongoDB ping failed: %s", exc)
            raise ConnectionError(f"Database health ping failed: {str(exc)}") from exc

    async def disconnect(self) -> None:
        """Gracefully close all active connection pools."""
        if self.client is not None:
            logger.info("Closing active MongoDB client connection pool...")
            self.client.close()
            self.client = None
            self.db = None
            logger.info("MongoDB connection pool cleanly terminated.")

    async def init_indexes(self) -> None:
        """Create necessary collections and indexes for TaskPilot domains."""
        if self.db is None:
            raise ConnectionError("Cannot create indexes: Database connection is not initialized.")

        logger.info("Ensuring MongoDB collection indexes...")

        # 1. Users collection indexes (unique email and username)
        users_col: AsyncIOMotorCollection = self.db["users"]
        await users_col.create_index(
            [("email", pymongo.ASCENDING)],
            unique=True,
            name="idx_users_email_unique",
        )
        await users_col.create_index(
            [("username", pymongo.ASCENDING)],
            unique=True,
            sparse=True,
            name="idx_users_username_unique",
        )

        # 2. Projects collection indexes (owner lookup, members lookup)
        projects_col: AsyncIOMotorCollection = self.db["projects"]
        await projects_col.create_index(
            [("owner_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)],
            name="idx_projects_owner_created",
        )
        await projects_col.create_index(
            [("member_ids", pymongo.ASCENDING)],
            name="idx_projects_members",
        )

        # 3. Tasks collection indexes (filtering by project, status, assignee)
        tasks_col: AsyncIOMotorCollection = self.db["tasks"]
        await tasks_col.create_index(
            [("project_id", pymongo.ASCENDING), ("status", pymongo.ASCENDING)],
            name="idx_tasks_project_status",
        )
        await tasks_col.create_index(
            [("assignee_id", pymongo.ASCENDING), ("due_date", pymongo.ASCENDING)],
            name="idx_tasks_assignee_due",
        )
        await tasks_col.create_index(
            [("title", pymongo.TEXT), ("description", pymongo.TEXT)],
            name="idx_tasks_text_search",
        )

        # 4. Knowledge / Documents collection indexes (for RAG & project attachments)
        documents_col: AsyncIOMotorCollection = self.db["documents"]
        await documents_col.create_index(
            [("project_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)],
            name="idx_documents_project_created",
        )

        logger.info("MongoDB indexes successfully created and verified.")

    def get_database(self) -> AsyncIOMotorDatabase:
        """Return the active database instance, raising RuntimeError if uninitialized."""
        if self.db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return self.db

    def get_collection(self, collection_name: str) -> AsyncIOMotorCollection:
        """Retrieve a collection from the active database."""
        return self.get_database()[collection_name]


# Module singleton instance
db_manager = MongoDBManager()


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency for accessing the primary application database.

    Returns:
        AsyncIOMotorDatabase: Active async database instance.

    Raises:
        RuntimeError: If database connection is requested before initialization.
    """
    if db_manager.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return db_manager.db


def get_collection(collection_name: str) -> AsyncIOMotorCollection:
    """Helper utility for retrieving a typed collection handle.

    Args:
        collection_name (str): Name of the MongoDB collection.

    Returns:
        AsyncIOMotorCollection: Active async collection handle.
    """
    database = get_database()
    return database[collection_name]
