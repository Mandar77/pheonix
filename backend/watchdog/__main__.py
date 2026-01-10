import threading
import signal

from backend.db.connection import get_database
from .watchdog import Watchdog


def _run_admin_app():
    try:
        from backend.api.admin import app as admin_app
        # run Flask dev server for demo purposes; no reloader to avoid double threads
        admin_app.run(port=5001, use_reloader=False)
    except Exception:
        # admin app may not be available or already running
        pass


def main():
    db = get_database()
    watchdog = Watchdog(db)

    # Start admin API in a background thread so /admin/kill is available
    admin_thread = threading.Thread(target=_run_admin_app, daemon=True)
    admin_thread.start()

    def _handle_sigint(signum, frame):
        watchdog.kill_orchestrator()
        raise SystemExit()

    signal.signal(signal.SIGINT, _handle_sigint)
    signal.signal(signal.SIGTERM, _handle_sigint)

    try:
        watchdog.run()
    except KeyboardInterrupt:
        watchdog.kill_orchestrator()


if __name__ == "__main__":
    main()
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
