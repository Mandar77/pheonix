from ..db.connection import get_database
from .watchdog import Watchdog

if __name__ == "__main__":
    print("=" * 60)
    print("🔥 PHOENIX WATCHDOG STARTING 🔥")
    print("Monitoring orchestrator for crashes and timeouts...")
    print("=" * 60)
    
    db = get_database()
    watchdog = Watchdog(db)
    
    try:
        watchdog.run()
    except KeyboardInterrupt:
        print("\n🛑 Watchdog stopped by user")
        watchdog.kill_orchestrator()
