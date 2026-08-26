import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import threading
import webbrowser
import time
from backend import create_app

app = create_app()

def open_browser():
    time.sleep(1.5)
    try:
        webbrowser.open_new('http://127.0.0.1:5000')
    except Exception:
        pass

if __name__ == '__main__':
    print('=' * 60)
    print('Healthcare Chatbot Starting...')
    print('=' * 60)
    print(f"Diseases Loaded: {len(app.config.get('DISEASES', []))}")
    print(f"Database: instance/healthcare_chatbot.db")
    port = int(os.environ.get('PORT', 5000))
    print(f'\nServer starting on 0.0.0.0:{port}')
    print('Press CTRL+C to stop\n')
    
    # Start thread to open browser automatically
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run Flask server
    app.run(debug=False, host='0.0.0.0', port=port)


