#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import tempfile
import time
import fcntl

DATA_DIR = Path(os.environ.get('XUEFENG_RUNNER_DATA_DIR', '/var/lib/xuefeng-runner'))
DATA_FILE = DATA_DIR / 'scores.json'
META_FILE = DATA_DIR / 'meta.json'
LOCK_FILE = DATA_DIR / 'scores.lock'
MAX_BODY = 4096
MAX_SCORE = int(os.environ.get('XUEFENG_RUNNER_MAX_SCORE', '200000'))
MAX_NAME_LENGTH = 12
ALLOWED_DIFFICULTIES = {'简单', '普通', '困难'}


def ensure_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text('[]\n')
    if not LOCK_FILE.exists():
        LOCK_FILE.write_text('')


def clean_name(value):
    value = str(value or '').strip()
    value = ' '.join(value.split())[:MAX_NAME_LENGTH]
    if not value or value.startswith('__'):
        return None
    return value


def clean_difficulty(value):
    value = str(value or '').strip()[:8]
    return value if value in ALLOWED_DIFFICULTIES else None


def clean_score(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        score = value
    elif isinstance(value, str) and value.strip().isdigit():
        score = int(value.strip())
    else:
        return None
    if score <= 0 or score > MAX_SCORE:
        return None
    return score


def clean_row(row):
    if not isinstance(row, dict):
        return None
    score = clean_score(row.get('score', 0))
    name = clean_name(row.get('name'))
    difficulty = clean_difficulty(row.get('difficulty'))
    if score is None or name is None or difficulty is None:
        return None
    return {
        'name': name,
        'score': score,
        'difficulty': difficulty,
        'at': str(row.get('at') or '')[:40],
    }


def best_scores(rows):
    best = {}
    for row in rows:
        clean = clean_row(row)
        if clean is None:
            continue
        key = (clean['difficulty'], clean['name'])
        previous = best.get(key)
        if (
            previous is None
            or clean['score'] > previous['score']
            or (clean['score'] == previous['score'] and clean['at'] > previous.get('at', ''))
        ):
            best[key] = clean
    ranked = list(best.values())
    ranked.sort(key=lambda r: (-r['score'], r['difficulty'], r['name'], r['at']))
    return ranked


def load_scores_unlocked():
    try:
        rows = json.loads(DATA_FILE.read_text())
    except Exception:
        rows = []
    if not isinstance(rows, list):
        return []
    return best_scores(rows)


def load_total_games_unlocked(rows):
    try:
        meta = json.loads(META_FILE.read_text())
        total = int(meta.get('total_games', 0))
    except Exception:
        total = len(rows)
        save_total_games_unlocked(total)
    return max(total, len(rows))


def save_total_games_unlocked(total):
    payload = {'total_games': max(0, int(total))}
    write_json_atomic(META_FILE, payload, prefix='meta-')


def save_scores_unlocked(rows):
    save_rows = best_scores(rows)
    write_json_atomic(DATA_FILE, save_rows, prefix='scores-')


def validated_entry(payload):
    if not isinstance(payload, dict):
        return None, 'bad_json'
    name = clean_name(payload.get('name'))
    if name is None:
        return None, 'bad_name'
    difficulty = clean_difficulty(payload.get('difficulty'))
    if difficulty is None:
        return None, 'bad_difficulty'
    score = clean_score(payload.get('score'))
    if score is None:
        return None, 'bad_score'
    return {
        'name': name,
        'score': score,
        'difficulty': difficulty,
        'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }, None


def write_json_atomic(path, payload, prefix):
    fd, tmp = tempfile.mkstemp(prefix=prefix, suffix='.json', dir=str(DATA_DIR))
    try:
        with os.fdopen(fd, 'w') as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
            fh.write('\n')
        os.replace(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def leaderboard_payload(rows, total_games):
    return {
        'scores': best_scores(rows),
        'total_games': total_games,
        'total_players': len({row['name'] for row in rows}),
        'players_by_difficulty': {
            diff: sum(1 for row in rows if row['difficulty'] == diff)
            for diff in ('简单', '普通', '困难')
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = 'XuefengRunnerAPI/1.2'

    def log_message(self, fmt, *args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?', 1)[0] != '/api/leaderboard':
            self.send_json(404, {'error': 'not_found'})
            return
        ensure_store()
        with LOCK_FILE.open('r+') as lock:
            fcntl.flock(lock, fcntl.LOCK_SH)
            rows = load_scores_unlocked()
            total_games = load_total_games_unlocked(rows)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, leaderboard_payload(rows, total_games))

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/api/score':
            self.send_json(404, {'error': 'not_found'})
            return
        length = int(self.headers.get('Content-Length', '0') or '0')
        if length <= 0 or length > MAX_BODY:
            self.send_json(400, {'error': 'bad_body'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception:
            self.send_json(400, {'error': 'bad_json'})
            return
        entry, error = validated_entry(payload)
        if entry is None:
            self.send_json(400, {'error': error})
            return
        ensure_store()
        with LOCK_FILE.open('r+') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            rows = load_scores_unlocked()
            total_games = load_total_games_unlocked(rows) + 1
            rows.append(entry)
            rows = best_scores(rows)
            save_scores_unlocked(rows)
            save_total_games_unlocked(total_games)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, {'ok': True, **leaderboard_payload(rows, total_games)})


if __name__ == '__main__':
    ensure_store()
    server = ThreadingHTTPServer(('127.0.0.1', 8787), Handler)
    server.serve_forever()
