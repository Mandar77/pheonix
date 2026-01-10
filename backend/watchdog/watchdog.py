import subprocess
import time
import sys
from datetime import datetime
from .heartbeat_monitor import HeartbeatMonitor

CHECK_INTERVAL_SECONDS = 5
MAX_RESTART_ATTEMPTS = 10

class Watchdog:
    """
    Monitors and restarts the orchestrator process
    Zero knowledge of workflow semantics - only cares about process health
    """
    
    def __init__(self, db):
        self.db = db
        self.monitor = HeartbeatMonitor(db)
        self.orchestrator_process = None
        self.restart_count = 0
    
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
            self.orchestrator_process.kill()
            self.orchestrator_process.wait()  # Wait for process to die
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
    
    def run(self):
        """Main watchdog loop - monitors and restarts orchestrator"""
        self.log_event("INFO", "🔥 Watchdog started - Phoenix protection active 🔥")
        self.start_orchestrator()
        
        while True:
            time.sleep(CHECK_INTERVAL_SECONDS)
            
            # Check 1: Heartbeat timeout (orchestrator frozen/stuck)
            if not self.monitor.is_orchestrator_alive():
                self.log_event("ERROR", "Orchestrator heartbeat timeout detected!")
                
                if self.restart_count >= MAX_RESTART_ATTEMPTS:
                    self.log_event("ERROR", "Max restart attempts reached, giving up")
                    break
                
                self.restart_orchestrator()
            
            # Check 2: Process crashed (belt-and-suspenders approach)
            elif self.orchestrator_process and self.orchestrator_process.poll() is not None:
                self.log_event("ERROR", "Orchestrator process died unexpectedly!")
                
                if self.restart_count >= MAX_RESTART_ATTEMPTS:
                    self.log_event("ERROR", "Max restart attempts reached, giving up")
                    break
                
                self.restart_orchestrator()
