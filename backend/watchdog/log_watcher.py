"""Demo log watcher for recovery visualization.

Tries to open a MongoDB change stream on the `logs` collection and prints
matching recovery events. If change streams aren't available (standalone
mongod), falls back to polling the `logs` collection every 2s.
"""
import time
import re
from datetime import datetime

from backend.db.connection import get_database


RECOVERY_RE = re.compile(r"Recovered|Recovering|retry", re.IGNORECASE)


def print_event(doc):
    ts = doc.get("timestamp")
    msg = doc.get("message")
    lvl = doc.get("level")
    comp = doc.get("component")
    print(f"[LOG WATCHER] {ts} {lvl} {comp}: {msg}")


def watch_with_change_stream(db):
    print("Log watcher: using change stream")
    pipeline = [
        {"$match": {"fullDocument.message": {"$regex": "Recovered|Recovering|retry", "$options": "i"}}}
    ]
    with db.logs.watch(pipeline=pipeline, full_document='updateLookup') as stream:
        for change in stream:
            doc = change.get("fullDocument")
            if doc:
                print_event(doc)


def watch_with_polling(db):
    print("Log watcher: change stream unavailable, using polling fallback")
    last_ts = datetime.utcnow().isoformat()
    while True:
        rows = list(db.logs.find({
            "timestamp": {"$gt": last_ts},
            "message": {"$regex": "Recovered|Recovering|retry", "$options": "i"}
        }).sort([("timestamp", 1)]))
        for r in rows:
            print_event(r)
            last_ts = r.get("timestamp") or last_ts
        time.sleep(2)


def main():
    db = get_database()

    # Try change stream first, fallback to polling
    try:
        # simple probe to ensure server supports change streams
        watch_with_change_stream(db)
    except Exception as e:
        # fallback
        print("change stream error:", e)
        watch_with_polling(db)


if __name__ == "__main__":
    main()
