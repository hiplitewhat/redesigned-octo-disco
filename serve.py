#!/usr/bin/env python3
"""Static server with no-cache headers so the preview always gets fresh JS."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)

if __name__ == "__main__":
    host, port = "0.0.0.0", 8000
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Studio Lite at http://{host}:{port}/", flush=True)
    httpd.serve_forever()
