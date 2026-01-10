from flask import Flask, jsonify
from backend.db.connection import get_database

app = Flask(__name__)

# kill_callback should be set by the watchdog at runtime
kill_callback = None


@app.route('/admin/kill', methods=['POST'])
def kill_orchestrator():
    db = get_database()
    db.logs.insert_one({
        "timestamp": __import__('datetime').datetime.utcnow().isoformat(),
        "level": "WARN",
        "component": "Watchdog",
        "message": "Kill switch activated - terminating orchestrator",
        "workflow_id": None,
        "task_id": None
    })

    if kill_callback:
        try:
            kill_callback()
        except Exception as e:
            return jsonify({"killed": False, "error": str(e)}), 500

    return jsonify({"killed": True, "timestamp": __import__('datetime').datetime.utcnow().isoformat()})
