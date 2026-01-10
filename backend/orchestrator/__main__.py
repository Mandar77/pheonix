import os
import signal
import time
from datetime import datetime

from backend.db.connection import get_database

running = True


def handle_sigterm(signum, frame):
    global running
    running = False


def main():
    signal.signal(signal.SIGTERM, handle_sigterm)
    db = get_database()
    col = db.orchestrator_heartbeat

    # ensure the doc exists
    col.update_one({"_id": "orchestrator_primary"}, {"$setOnInsert": {"restarts": 0}}, upsert=True)

    print("Orchestrator started, emitting heartbeats")
    while running:
        col.update_one({"_id": "orchestrator_primary"}, {"$set": {"last_heartbeat": datetime.utcnow().isoformat(), "status": "RUNNING"}}, upsert=True)
        time.sleep(1)

    print("Orchestrator received SIGTERM, exiting")


if __name__ == "__main__":
    main()
