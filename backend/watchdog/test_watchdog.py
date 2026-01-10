import sys
import os

print("Starting watchdog test...")

from backend.db.connection import get_database
from backend.watchdog.watchdog import Watchdog

print("Imports successful!")

db = get_database()
print("Database connected!")

watchdog = Watchdog(db)
print("Watchdog created!")

print("\nWatchdog test completed successfully!")