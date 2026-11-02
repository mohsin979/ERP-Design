"""Dev server for the prototype: like `python3 -m http.server`, but tells the browser never to
reuse a cached copy, so every reload runs the current .jsx files (no stale-script mix)."""
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

class Server(http.server.ThreadingHTTPServer):
    # The page asks for ~55 scripts at once; the default backlog (5) reset some of them.
    request_queue_size = 256

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
Server(('', port), NoCache).serve_forever()
