import os
from pymongo import MongoClient
from dotenv import load_dotenv
import certifi

load_dotenv()

_client = None
_db = None

def get_database():
    global _client, _db
    
    if _db is None:
        mongodb_uri = os.getenv("MONGODB_URI")
        database_name = os.getenv("DATABASE_NAME", "phoenix_db")
        
        # Use certifi for SSL certificates
        _client = MongoClient(
            mongodb_uri,
            tlsCAFile=certifi.where()
        )
        _db = _client[database_name]
        
        print(f"Connected to MongoDB: {database_name}")
    
    return _db

def close_database():
    global _client
    if _client:
        _client.close()