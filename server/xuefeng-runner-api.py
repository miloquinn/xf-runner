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
MAX_META_ITEMS = 300
UNKNOWN_REGION = '未知'
LOCAL_REGION = '本地'
COUNTRY_NAMES = {
    'CN': '中国大陆',
    'HK': '中国香港',
    'MO': '中国澳门',
    'TW': '中国台湾',
    'US': '美国',
    'SG': '新加坡',
    'JP': '日本',
    'KR': '韩国',
    'GB': '英国',
    'CA': '加拿大',
    'AU': '澳大利亚',
    'DE': '德国',
    'FR': '法国',
    'MY': '马来西亚',
    'TH': '泰国',
    'VN': '越南',
}


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


def clean_count(value):
    if isinstance(value, bool):
        return None
    try:
        count = int(value)
    except Exception:
        return None
    if count <= 0:
        return None
    return min(count, 100000000)


def clean_region(value):
    value = str(value or '').strip()
    value = ' '.join(value.split())[:24]
    if not value or value.startswith('__'):
        return UNKNOWN_REGION
    return value


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


def seed_player_games(rows):
    seeded = {}
    for row in rows:
        clean = clean_row(row)
        if clean is None:
            continue
        seeded[clean['name']] = max(1, seeded.get(clean['name'], 0))
    return seeded


def compact_counts(counts, max_items=MAX_META_ITEMS):
    cleaned = []
    for key, value in counts.items():
        count = clean_count(value)
        if count is None:
            continue
        label = clean_name(key) or clean_region(key)
        if label:
            cleaned.append((label, count))
    cleaned.sort(key=lambda item: (-item[1], item[0]))
    return dict(cleaned[:max_items])


def compact_region_counts(counts, max_items=MAX_META_ITEMS):
    cleaned = []
    for key, value in counts.items():
        count = clean_count(value)
        if count is None:
            continue
        label = clean_region(key)
        cleaned.append((label, count))
    cleaned.sort(key=lambda item: (-item[1], item[0]))
    return dict(cleaned[:max_items])


def load_meta_unlocked(rows):
    try:
        meta = json.loads(META_FILE.read_text())
        total = int(meta.get('total_games', 0))
    except Exception:
        meta = {}
        total = len(rows)
    player_games = compact_counts(meta.get('player_games', {})) if isinstance(meta.get('player_games'), dict) else {}
    if not player_games:
        player_games = seed_player_games(rows)
    else:
        for name, count in seed_player_games(rows).items():
            player_games[name] = max(count, player_games.get(name, 0))
    region_stats = (
        compact_region_counts(meta.get('region_stats', {}))
        if isinstance(meta.get('region_stats'), dict)
        else {}
    )
    return {
        'total_games': max(total, len(rows)),
        'player_games': compact_counts(player_games),
        'region_stats': compact_region_counts(region_stats),
    }


def save_meta_unlocked(meta):
    payload = {
        'total_games': max(0, int(meta.get('total_games', 0))),
        'player_games': compact_counts(meta.get('player_games', {})),
        'region_stats': compact_region_counts(meta.get('region_stats', {})),
    }
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


def client_region(headers, client_address):
    country = (headers.get('CF-IPCountry') or '').strip().upper()
    if country and country not in {'XX', 'T1'}:
        return COUNTRY_NAMES.get(country, country)
    ip = ''
    if client_address:
        ip = str(client_address[0] or '')
    if ip.startswith('127.') or ip == '::1':
        return LOCAL_REGION
    return UNKNOWN_REGION


def ranked_counts(counts, limit=100):
    rows = [
        {'name': str(name), 'games': int(games)}
        for name, games in counts.items()
        if clean_count(games) is not None
    ]
    rows.sort(key=lambda row: (-row['games'], row['name']))
    return rows[:limit]


def ranked_regions(counts, limit=20):
    rows = [
        {'region': clean_region(region), 'games': int(games)}
        for region, games in counts.items()
        if clean_count(games) is not None
    ]
    rows.sort(key=lambda row: (-row['games'], row['region']))
    return rows[:limit]


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


def leaderboard_payload(rows, meta):
    return {
        'scores': best_scores(rows),
        'total_games': meta['total_games'],
        'total_players': len({row['name'] for row in rows}),
        'players_by_difficulty': {
            diff: sum(1 for row in rows if row['difficulty'] == diff)
            for diff in ('简单', '普通', '困难')
        },
        'region_stats': ranked_regions(meta.get('region_stats', {})),
        'player_games': ranked_counts(meta.get('player_games', {})),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = 'XuefengRunnerAPI/1.3'

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
            meta = load_meta_unlocked(rows)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, leaderboard_payload(rows, meta))

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
            meta = load_meta_unlocked(rows)
            meta['total_games'] += 1
            meta['player_games'][entry['name']] = meta['player_games'].get(entry['name'], 0) + 1
            region = client_region(self.headers, self.client_address)
            meta['region_stats'][region] = meta['region_stats'].get(region, 0) + 1
            rows.append(entry)
            rows = best_scores(rows)
            save_scores_unlocked(rows)
            save_meta_unlocked(meta)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, {'ok': True, **leaderboard_payload(rows, meta)})


if __name__ == '__main__':
    ensure_store()
    server = ThreadingHTTPServer(('127.0.0.1', 8787), Handler)
    server.serve_forever()
