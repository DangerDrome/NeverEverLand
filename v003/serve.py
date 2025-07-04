#!/usr/bin/env python3
"""
Simple HTTP server for NeverEverLand v003
Serves files to avoid CORS issues with ES6 modules
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=Path(__file__).parent, **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Set correct MIME types for JavaScript modules
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'text/javascript')
        
        super().end_headers()
    
    def log_message(self, format, *args):
        # Customize log messages
        print(f"[{self.address_string()}] {format % args}")

def main():
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"🚀 NeverEverLand v003 Server")
        print(f"📡 Serving at http://localhost:{PORT}")
        print(f"📁 Directory: {os.getcwd()}")
        print(f"🎮 Open http://localhost:{PORT} in your browser")
        print(f"⏹️  Press Ctrl+C to stop")
        print("-" * 50)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
            sys.exit(0)

if __name__ == "__main__":
    main()