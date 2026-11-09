"""Dev server for the prototype: like `python3 -m http.server`, but tells the browser never to
reuse a cached copy, so every reload runs the current .jsx files (no stale-script mix).

It also keeps the prototype's saved data in SQLite (data/hof-erp.sqlite) instead of the browser's
localStorage — one key-value table, the same keys the app used there (store.jsx `DB`):
  GET    /api/kv          every key and its value, as one JSON object (read once per page load)
  GET    /api/kv/<key>    one value (204, empty, when there's none — a check, not an error)
  PUT    /api/kv/<key>    save a value (the body); X-Ver: a newer version only replaces an older one
  DELETE /api/kv/<key>    remove it (X-Ver as above)
  POST   /api/kv          save several at once (a JSON object of key → value): the first import of
                          what a browser had in localStorage
"""
import contextlib, http.server, json, os, sqlite3, sys, threading, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, 'data', 'hof-erp.sqlite')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
LOCK = threading.Lock()

@contextlib.contextmanager
def db():
    # One connection per request, committed and closed (writes are serialised by LOCK).
    con = sqlite3.connect(DB_PATH, timeout=30)
    try:
        con.execute('PRAGMA journal_mode=WAL')
        con.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0)')
        yield con
        con.commit()
    finally:
        con.close()

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    # ── /api/kv ──
    def _key(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/kv': return ''
        if path.startswith('/api/kv/'): return urllib.parse.unquote(path[len('/api/kv/'):])
        return None

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n).decode('utf-8') if n else ''

    def _ver(self):
        try: return int(self.headers.get('X-Ver') or 0)
        except ValueError: return 0

    def _send(self, code, body='', ctype='application/json; charset=utf-8'):
        data = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        key = self._key()
        if key is None: return super().do_GET()
        with LOCK, db() as con:
            if key == '':
                return self._send(200, json.dumps({k: v for k, v in con.execute('SELECT key, value FROM kv')}))
            row = con.execute('SELECT value FROM kv WHERE key = ?', (key,)).fetchone()
        return self._send(200, row[0], 'text/plain; charset=utf-8') if row else self._send(204)

    def do_PUT(self):
        key = self._key()
        if not key: return self._send(404, '')
        value, ver = self._body(), self._ver()
        with LOCK, db() as con:
            con.execute('INSERT INTO kv (key, value, ver) VALUES (?, ?, ?) '
                        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, ver = excluded.ver WHERE excluded.ver >= kv.ver', (key, value, ver))
        return self._send(204)

    def do_DELETE(self):
        key = self._key()
        if not key: return self._send(404, '')
        with LOCK, db() as con:
            con.execute('DELETE FROM kv WHERE key = ? AND ver <= ?', (key, self._ver()))
        return self._send(204)

    def do_POST(self):
        if self._key() != '': return self._send(404, '')
        items = json.loads(self._body() or '{}')
        with LOCK, db() as con:
            con.executemany('INSERT INTO kv (key, value, ver) VALUES (?, ?, 0) ON CONFLICT(key) DO NOTHING', [(k, str(v)) for k, v in items.items()])
        return self._send(204)

class Server(http.server.ThreadingHTTPServer):
    # The page asks for ~55 scripts at once; the default backlog (5) reset some of them.
    request_queue_size = 256

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
Server(('', port), NoCache).serve_forever()
