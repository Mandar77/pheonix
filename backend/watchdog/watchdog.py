import subprocess
import time
import sys
import subprocess
import time
import sys
from datetime import datetime, timedelta
from .heartbeat_monitor import HeartbeatMonitor

CHECK_INTERVAL_SECONDS = 5
MAX_RESTART_ATTEMPTS = 10
WORKER_DEAD_SECONDS = 30
TASK_STUCK_SECONDS = 5 * 60


class Watchdog:
    """
    Monitors and restarts the orchestrator process.
    Also monitors worker heartbeats and detects stuck tasks.
    """

    def __init__(self, db):
        self.db = db
        self.monitor = HeartbeatMonitor(db)
        self.orchestrator_process = None
        self.restart_count = 0

        # expose kill callback to admin API (optional)
        try:
            from backend.api import admin as admin_api

            def _kill_cb():
                self.kill_orchestrator()

            admin_api.kill_callback = _kill_cb
        except Exception:
            pass

    def start_orchestrator(self):
        """Launch orchestrator as subprocess"""
        self.orchestrator_process = subprocess.Popen(
            [sys.executable, "-m", "backend.orchestrator"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        self.log_event("INFO", f"Started orchestrator (PID: {self.orchestrator_process.pid})")
        return self.orchestrator_process

    def kill_orchestrator(self):
        """Forcefully terminate orchestrator"""
        if self.orchestrator_process:
            try:
                self.orchestrator_process.kill()
                self.orchestrator_process.wait(timeout=5)
            except Exception:
                pass
            self.log_event("WARN", "Killed orchestrator process")
            self.orchestrator_process = None

    def restart_orchestrator(self):
        """Kill and restart orchestrator - this is the Phoenix resurrection"""
        self.kill_orchestrator()
        self.restart_count += 1

        # Update restart count in DB
        self.db.orchestrator_heartbeat.update_one(
            {"_id": "orchestrator_primary"},
            {
                "$inc": {"restarts": 1},
                "$set": {"status": "RESTARTING"}
            },
            upsert=True
        )

        self.log_event("INFO", f"🔥 PHOENIX RESURRECTION #{self.restart_count} 🔥")
        self.start_orchestrator()

    def log_event(self, level, message):
        """Log watchdog events to MongoDB"""
        self.db.logs.insert_one({
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "component": "Watchdog",
            "message": message,
            "workflow_id": None,
            "task_id": None
        })
        print(f"[Watchdog] {level}: {message}")

    def _check_workers(self):
        """Detect workers that missed heartbeats and mark them OFFLINE"""
        dead_threshold = datetime.utcnow() - timedelta(seconds=WORKER_DEAD_SECONDS)
        dead_workers = list(self.db.workers.find({
            "status": "ONLINE",
            "lastHeartbeat": {"$lt": dead_threshold.isoformat()}
        }))

        for worker in dead_workers:
            worker_id = worker.get("workerId") or worker.get("_id")
            self.db.workers.update_one({"workerId": worker_id}, {"$set": {"status": "OFFLINE"}})
            self.db.logs.insert_one({
                "timestamp": datetime.utcnow().isoformat(),
                "level": "WARN",
                "component": "Watchdog",
                "message": f"Worker {worker.get('name')} marked as dead",
                "workflow_id": None,
                "task_id": None
            })
            print(f"[Watchdog] WARN: Worker {worker_id} appears dead")

    def _check_stuck_tasks(self):
        """Detect tasks that are locked for too long and log them"""
        stuck_threshold = datetime.utcnow() - timedelta(seconds=TASK_STUCK_SECONDS)
        stuck_tasks = list(self.db.tasks.find({
            "status": "IN_PROGRESS",
            "locked_at": {"$lt": stuck_threshold.isoformat()}
        }))

        if stuck_tasks:
            self.db.logs.insert_one({
                "timestamp": datetime.utcnow().isoformat(),
                "level": "WARN",
                "component": "Watchdog",
                "message": f"{len(stuck_tasks)} tasks appear stuck",
                "workflow_id": None,
                "task_id": None
            })
            print(f"[Watchdog] WARN: {len(stuck_tasks)} tasks appear stuck")

    def run(self):
        """Main watchdog loop - monitors orchestrator, workers, and tasks"""
        self.log_event("INFO", "🔥 Watchdog started - Phoenix protection active 🔥")
        self.start_orchestrator()

        while True:
            time.sleep(CHECK_INTERVAL_SECONDS)

            # Worker monitoring
            try:
                self._check_workers()
            except Exception as e:
                print("[Watchdog] ERROR checking workers:", e)

            # Stuck-task detection
            try:
                self._check_stuck_tasks()
            except Exception as e:
                print("[Watchdog] ERROR checking stuck tasks:", e)

            # Check 1: Heartbeat timeout (orchestrator frozen/stuck)
            try:
                if not self.monitor.is_orchestrator_alive():
                    self.log_event("ERROR", "Orchestrator heartbeat timeout detected!")

                    if self.restart_count >= MAX_RESTART_ATTEMPTS:
                        self.log_event("ERROR", "Max restart attempts reached, giving up")
                        break

                    self.restart_orchestrator()
                    continue
            except Exception as e:
                print("[Watchdog] ERROR checking orchestrator heartbeat:", e)

            # Check 2: Process crashed (belt-and-suspenders approach)
            if self.orchestrator_process and self.orchestrator_process.poll() is not None:
                self.log_event("ERROR", "Orchestrator process died unexpectedly!")

                if self.restart_count >= MAX_RESTART_ATTEMPTS:
                    self.log_event("ERROR", "Max restart attempts reached, giving up")
                    break

                self.restart_orchestrator()
