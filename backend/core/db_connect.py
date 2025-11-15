# backend/core/db_connect.py
import os
import atexit
import logging
from pymilvus import MilvusClient
from pymilvus.exceptions import MilvusException
from dotenv import load_dotenv

# --- FIX: Import the Asynchronous Neo4j driver ---
from neo4j import AsyncGraphDatabase
# --- End of fix ---

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# --- FIX: Use Docker service names as defaults ---
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "yourpassword") # Ensure this matches your .env
MILVUS_URI = os.getenv("MILVUS_URI", "http://standalone:19530")
# --- End of fixes ---


class DBManager:
    """
    Singleton class to manage asynchronous database connections (Neo4j + Milvus).
    """
    _instance = None
    _neo4j_driver = None
    _milvus_client = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(DBManager, cls).__new__(cls)
        return cls._instance

    # --- FIX: Made this function async ---
    async def get_neo4j_driver(self):
    # --- End of fix ---
        """
        Lazily initializes and returns the singleton async Neo4j driver.
        """
        if self._neo4j_driver is None:
            log.info("Initializing Neo4j async driver...")
            try:
                # --- FIX: Use AsyncGraphDatabase.driver ---
                self._neo4j_driver = AsyncGraphDatabase.driver(
                    NEO4J_URI,
                    auth=(NEO4J_USER, NEO4J_PASSWORD)
                )
                # --- End of fix ---
                
                # Verify connectivity asynchronously
                driver = self._neo4j_driver
                
                # --- FIX: Verify async driver correctly ---
                await driver.verify_connectivity()
                # --- End of fix ---
                
                log.info("✓ Neo4j async connection verified.")
            except Exception as e:
                log.error(f"❌ Failed to initialize Neo4j async driver: {e}")
                self._neo4j_driver = None
                raise
        return self._neo4j_driver

    def get_milvus_client(self) -> MilvusClient:
        """
        Lazily initializes and returns the singleton Milvus client.
        """
        if self._milvus_client is None:
            log.info("Initializing Milvus client...")
            try:
                self._milvus_client = MilvusClient(
                    uri=MILVUS_URI,
                    timeout=10  # seconds
                )
                # Test connection
                self._milvus_client.list_collections()
                log.info("✓ Milvus connection successful.")
            except MilvusException as e:
                log.error(f"❌ Milvus connection failed: {e}")
                self._milvus_client = None
                raise
            except Exception as e:
                log.error(f"❌ Unexpected error connecting to Milvus: {e}")
                self._milvus_client = None
                raise
        return self._milvus_client

    # --- FIX: Make this function asynchronous ---
    async def close_connections(self):
    # --- End of fix ---
        """
        Asynchronously closes all database connections.
        Must be awaited in async context (e.g., FastAPI shutdown event).
        """
        if self._neo4j_driver:
            log.info("Closing Neo4j async driver...")
            try:
                # --- FIX: Await the async close ---
                await self._neo4j_driver.close()
                # --- End of fix ---
                log.info("Neo4j driver closed.")
            except Exception as e:
                log.warning(f"Error closing Neo4j driver: {e}")
            finally:
                self._neo4j_driver = None

        if self._milvus_client:
            log.info("Closing Milvus client...")
            try:
                self._milvus_client.close()
                log.info("Milvus client closed.")
            except Exception as e:
                log.warning(f"Error closing Milvus client: {e}")
            finally:
                self._milvus_client = None


# Singleton instance
db_manager = DBManager()

# --- FIX: Remove synchronous atexit, as it conflicts with async shutdown ---
# atexit.register(_sync_close)
# --- End of fix ---