#!/usr/bin/env python3
"""SPA fallback server for Angular app. Serves index.html for all routes
that don't match an actual file, so client-side routing works on refresh."""
import http.server
import socketserver
import os

PORT = 4201
DIRECTORY = "dist/app/browser"

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Translate the URL path to a file path
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            # Serve index.html for client-side routing
            self.path = "/index.html"
        return super().do_GET()

with socketserver.ThreadingTCPServer(("", PORT), SPAHandler) as httpd:
    print(f"Serving SPA at http://localhost:{PORT}")
    httpd.serve_forever()
