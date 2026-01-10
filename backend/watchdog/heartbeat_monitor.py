from datetime import datetime, timedelta

HEARTBEAT_TIMEOUT_SECONDS = 30

class HeartbeatMonitor:
    """Monitors orchestrator heartbeat to detect if it's alive"""
    
    def __init__(self, db):
        self.db = db
    
    def is_orchestrator_alive(self):
        """
        Returns True if orchestrator heartbeat is fresh, False otherwise
        Checks if last heartbeat was within the timeout period
        """
        heartbeat = self.db.orchestrator_heartbeat.find_one(
            {"_id": "orchestrator_primary"}
        )
        
        # No heartbeat document = orchestrator never started or dead
        if not heartbeat:
            return False
        
        last_heartbeat_str = heartbeat.get("last_heartbeat")
        if not last_heartbeat_str:
            return False
        
        # Calculate time since last heartbeat
        last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
        time_since_heartbeat = datetime.utcnow() - last_heartbeat
        
        # Alive if heartbeat is recent
        return time_since_heartbeat.total_seconds() < HEARTBEAT_TIMEOUT_SECONDS