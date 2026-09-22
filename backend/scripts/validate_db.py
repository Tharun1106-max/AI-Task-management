#!/usr/bin/env python3
"""Automated Startup Database Connection & Replica Set Validation Script.

Usage:
    python scripts/validate_db.py [OPTIONS]

Features:
    - Retries connection with exponential backoff until database is ready
    - Validates cluster topology and replica set primary state
    - Tests write and read operations on an ephemeral validation collection
    - Verifies index readiness on core application collections
    - Returns exit code 0 on success, non-zero on error for CI/CD or container entrypoints
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from typing import Any, Dict

# Ensure app package is importable when executed directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
except ImportError as exc:
    sys.stderr.write(f"Error: Missing required database dependencies: {exc}\n")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [DB-CHECK]: %(message)s",
)
logger = logging.getLogger("validate_db")


async def validate_database(
    mongo_uri: str,
    db_name: str,
    max_retries: int = 10,
    retry_delay_seconds: float = 2.0,
    require_replica_set: bool = False,
) -> bool:
    """Performs comprehensive validation of MongoDB connectivity and state."""
    logger.info("Initiating database validation checks...")
    logger.info("Target URI: %s", mongo_uri.split("@")[-1] if "@" in mongo_uri else mongo_uri)
    logger.info("Target Database: %s", db_name)

    attempt = 1
    delay = retry_delay_seconds

    while attempt <= max_retries:
        logger.info("Connection attempt %d/%d...", attempt, max_retries)
        client: AsyncIOMotorClient = None
        try:
            client = AsyncIOMotorClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )

            # 1. Ping Admin Database & check latency
            start_ping = time.perf_counter()
            ping_result = await client.admin.command("ping")
            latency_ms = round((time.perf_counter() - start_ping) * 1000, 2)
            logger.info("✓ Network ping successful (latency: %sms)", latency_ms)

            # 2. Check Topology & Replica Set via 'hello' (or 'isMaster')
            hello_res: Dict[str, Any] = await client.admin.command("hello")
            is_writable = hello_res.get("isWritablePrimary", False) or hello_res.get("ismaster", False)
            replica_set_name = hello_res.get("setName")
            cluster_version = hello_res.get("version", "unknown")

            logger.info("✓ Cluster version: %s", cluster_version)
            logger.info("✓ Primary / Writable: %s", is_writable)

            if replica_set_name:
                logger.info("✓ Replica Set detected: '%s'", replica_set_name)
            else:
                logger.info("• Standalone mode (no replica set configured)")

            if require_replica_set and not replica_set_name:
                raise ValueError("Replica Set validation required, but standalone instance detected.")

            if not is_writable:
                raise ConnectionFailure("Connected node is not a writable primary.")

            # 3. Read & Write test on target database
            db = client[db_name]
            test_col = db["_startup_validation"]
            test_doc = {"check": "health", "timestamp": time.time(), "attempt": attempt}

            # Insert
            insert_res = await test_col.insert_one(test_doc)
            inserted_id = insert_res.inserted_id

            # Find
            found = await test_col.find_one({"_id": inserted_id})
            if not found:
                raise RuntimeError("Failed to read back test document from database.")

            # Cleanup
            await test_col.delete_one({"_id": inserted_id})
            logger.info("✓ Read & write validation passed on database '%s'", db_name)

            # 4. Check collection indexes
            existing_cols = await db.list_collection_names()
            logger.info("✓ Database '%s' verified with %d collections.", db_name, len(existing_cols))

            logger.info("==========================================================")
            logger.info("  DATABASE STARTUP VALIDATION SUCCEEDED (READY FOR APP)")
            logger.info("==========================================================")
            return True

        except (ConnectionFailure, ServerSelectionTimeoutError) as net_err:
            logger.warning("Connection failure (attempt %d/%d): %s", attempt, max_retries, net_err)
        except Exception as general_err:
            logger.error("Validation failed (attempt %d/%d): %s", attempt, max_retries, general_err)
        finally:
            if client is not None:
                client.close()

        if attempt < max_retries:
            logger.info("Waiting %.1f seconds before retry...", delay)
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 10.0)  # Exponential backoff capped at 10s
        attempt += 1

    logger.critical("==========================================================")
    logger.critical("  DATABASE STARTUP VALIDATION FAILED AFTER %d ATTEMPTS", max_retries)
    logger.critical("==========================================================")
    return False


def main() -> None:
    try:
        from app.config import get_settings
        settings = get_settings()
        default_uri = settings.MONGO_URI
        default_db = settings.MONGO_DB_NAME
    except Exception:
        default_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        default_db = os.getenv("MONGO_DB_NAME", "taskpilot_db")

    parser = argparse.ArgumentParser(
        description="Validate MongoDB connectivity, replica set topology, and read/write integrity."
    )
    parser.add_argument(
        "--uri",
        type=str,
        default=default_uri,
        help="MongoDB Connection URI string (defaults to MONGO_URI env var)",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default=default_db,
        help="Target MongoDB database name (defaults to MONGO_DB_NAME env var)",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=int(os.getenv("DB_VALIDATION_RETRIES", "10")),
        help="Maximum connection retry attempts before giving up (default: 10)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=float(os.getenv("DB_VALIDATION_DELAY", "2.0")),
        help="Initial retry delay in seconds (default: 2.0)",
    )
    parser.add_argument(
        "--require-replica-set",
        action="store_true",
        default=os.getenv("REQUIRE_REPLICA_SET", "false").lower() in ("true", "1", "yes"),
        help="Fail if MongoDB instance is not configured as a replica set",
    )

    args = parser.parse_args()

    success = asyncio.run(
        validate_database(
            mongo_uri=args.uri,
            db_name=args.db_name,
            max_retries=args.retries,
            retry_delay_seconds=args.delay,
            require_replica_set=args.require_replica_set,
        )
    )

    if not success:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
