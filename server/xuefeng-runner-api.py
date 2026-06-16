#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import tempfile
import time
import unicodedata
import fcntl
import ipaddress
import urllib.error
import urllib.parse
import urllib.request

DATA_DIR = Path(os.environ.get('XUEFENG_RUNNER_DATA_DIR', '/var/lib/xuefeng-runner'))
DATA_FILE = DATA_DIR / 'scores.json'
META_FILE = DATA_DIR / 'meta.json'
LOCK_FILE = DATA_DIR / 'scores.lock'
SECRET_FILE = DATA_DIR / 'api-secret.key'
NAME_BLOCKLIST_FILE = Path(os.environ.get('XUEFENG_RUNNER_NAME_BLOCKLIST', DATA_DIR / 'name-blocklist.txt'))
MAX_BODY = 4096
MAX_SCORE = int(os.environ.get('XUEFENG_RUNNER_MAX_SCORE', '180000'))
MAX_NAME_LENGTH = 12
ALLOWED_DIFFICULTIES = {'简单', '普通', '困难'}
MAX_META_ITEMS = 300
SESSION_MAX_AGE = int(os.environ.get('XUEFENG_RUNNER_SESSION_MAX_AGE', '2700'))
SESSION_MIN_AGE = float(os.environ.get('XUEFENG_RUNNER_SESSION_MIN_AGE', '2.0'))
SESSION_SCORE_GRACE = int(os.environ.get('XUEFENG_RUNNER_SESSION_SCORE_GRACE', '12000'))
SESSION_SCORE_PER_SECOND = int(os.environ.get('XUEFENG_RUNNER_SESSION_SCORE_PER_SECOND', '1700'))
IP_LOOKUP_ENABLED = os.environ.get('XUEFENG_RUNNER_IP_LOOKUP', '1') != '0'
IP_LOOKUP_TIMEOUT = float(os.environ.get('XUEFENG_RUNNER_IP_LOOKUP_TIMEOUT', '1.2'))
IP_LOOKUP_CACHE_TTL = int(os.environ.get('XUEFENG_RUNNER_IP_LOOKUP_CACHE_TTL', '86400'))
MAX_REGION_RETRY_ITEMS = 1000
UNKNOWN_REGION = '未知'
UNKNOWN_CHINA_REGION = '未知省份'
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
CHINA_REGION_NAMES = {
    'AH': '安徽',
    'BJ': '北京',
    'CQ': '重庆',
    'FJ': '福建',
    'GD': '广东',
    'GS': '甘肃',
    'GX': '广西',
    'GZ': '贵州',
    'HA': '河南',
    'HB': '湖北',
    'HE': '河北',
    'HI': '海南',
    'HK': '香港',
    'HL': '黑龙江',
    'HN': '湖南',
    'JL': '吉林',
    'JS': '江苏',
    'JX': '江西',
    'LN': '辽宁',
    'MO': '澳门',
    'NM': '内蒙古',
    'NX': '宁夏',
    'QH': '青海',
    'SC': '四川',
    'SD': '山东',
    'SH': '上海',
    'SN': '陕西',
    'SX': '山西',
    'TJ': '天津',
    'TW': '台湾',
    'XJ': '新疆',
    'XZ': '西藏',
    'YN': '云南',
    'ZJ': '浙江',
}
CHINA_REGION_ALIASES = {
    'anhui': '安徽',
    'beijing': '北京',
    'chongqing': '重庆',
    'fujian': '福建',
    'guangdong': '广东',
    'gansu': '甘肃',
    'guangxi': '广西',
    'guizhou': '贵州',
    'henan': '河南',
    'hubei': '湖北',
    'hebei': '河北',
    'hainan': '海南',
    'hong kong': '香港',
    'heilongjiang': '黑龙江',
    'hunan': '湖南',
    'jilin': '吉林',
    'jiangsu': '江苏',
    'jiangxi': '江西',
    'liaoning': '辽宁',
    'macau': '澳门',
    'macao': '澳门',
    'inner mongolia': '内蒙古',
    'ningxia': '宁夏',
    'qinghai': '青海',
    'sichuan': '四川',
    'shandong': '山东',
    'shanghai': '上海',
    'shaanxi': '陕西',
    'shanxi': '山西',
    'tianjin': '天津',
    'taiwan': '台湾',
    'xinjiang': '新疆',
    'xizang': '西藏',
    'tibet': '西藏',
    'yunnan': '云南',
    'zhejiang': '浙江',
}
IP_REGION_CACHE = {}
CONTACT_PATTERNS = (
    re.compile(r'(?<!\d)(?:\+?86[-_\s]*)?1[3-9](?:[-_\s]*\d){9}(?!\d)'),
    re.compile(r'(?<!\d)\d{8,12}(?!\d)'),
    re.compile(r'(?:qq|q号)[-_\s]*(?:\d[-_\s]*){8,12}', re.I),
    re.compile(r'(?:vx|wx|v信|微信|威信|薇信)[-_\s]*[a-z0-9_][a-z0-9_\-\s]{4,24}', re.I),
    re.compile(r'[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}', re.I),
    re.compile(r'(?:https?://|www\.|\.com|\.cn|\.net|\.top|\.shop)', re.I),
)
CONTACT_KEYWORDS = {
    '手机号', '电话', '加我', '私聊', '联系我', '群号',
}
SENSITIVE_CHAR_FOLD = str.maketrans({
    '習': '习',
    '迈': '近',
    '邁': '近',
    '进': '近',
    '進': '近',
    '劲': '近',
    '勁': '近',
    '乎': '平',
    '苹': '平',
    '蘋': '平',
    '评': '平',
    '評': '平',
    '萍': '平',
    '屏': '平',
    '瓶': '平',
})
DEFAULT_NAME_BLOCKLIST = {
    '政治敏感', '敏感政治', '政治内容', '政治口号', '反动',
    '台独', '港独', '疆独', '藏独',
    '法轮功', '六四', '天安门事件',
}
_NAME_BLOCKLIST_CACHE = None
_NAME_BLOCKLIST_MTIME = None


def ensure_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text('[]\n')
    if not LOCK_FILE.exists():
        LOCK_FILE.write_text('')
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_urlsafe(48))
        try:
            SECRET_FILE.chmod(0o600)
        except OSError:
            pass


def normalized_name_text(value):
    text = unicodedata.normalize('NFKC', str(value or '')).lower()
    return ''.join(ch for ch in text if ch.isalnum() or '\u4e00' <= ch <= '\u9fff')


def sensitive_name_skeleton(value):
    return normalized_name_text(value).translate(SENSITIVE_CHAR_FOLD)


def name_blocklist():
    global _NAME_BLOCKLIST_CACHE, _NAME_BLOCKLIST_MTIME
    try:
        stat = NAME_BLOCKLIST_FILE.stat()
        mtime = stat.st_mtime
    except OSError:
        mtime = None
    if _NAME_BLOCKLIST_CACHE is not None and _NAME_BLOCKLIST_MTIME == mtime:
        return _NAME_BLOCKLIST_CACHE

    words = {sensitive_name_skeleton(word) for word in DEFAULT_NAME_BLOCKLIST}
    if mtime is not None:
        try:
            for line in NAME_BLOCKLIST_FILE.read_text(encoding='utf-8').splitlines():
                word = line.split('#', 1)[0].strip()
                if word:
                    words.add(sensitive_name_skeleton(word))
        except OSError:
            pass
    _NAME_BLOCKLIST_CACHE = {word for word in words if word}
    _NAME_BLOCKLIST_MTIME = mtime
    return _NAME_BLOCKLIST_CACHE


def forbidden_name_reason(value):
    raw = unicodedata.normalize('NFKC', str(value or '')).strip()
    normalized = normalized_name_text(raw)
    sensitive_text = sensitive_name_skeleton(raw)
    if not raw:
        return 'empty'
    if any(pattern.search(raw) for pattern in CONTACT_PATTERNS):
        return 'contact'
    if any(keyword in normalized for keyword in CONTACT_KEYWORDS):
        return 'contact'
    if sensitive_text and any(word in sensitive_text for word in name_blocklist()):
        return 'sensitive'
    return ''


def clean_name(value):
    raw = str(value or '').strip()
    value = ' '.join(raw.split())[:MAX_NAME_LENGTH]
    if not value or value.startswith('__') or forbidden_name_reason(raw) or forbidden_name_reason(value):
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
    if value in {'中国大陆', '中國大陸'}:
        return UNKNOWN_CHINA_REGION
    return value


def b64url_encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')


def b64url_decode(value):
    padding = '=' * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode('ascii'))


def signing_secret():
    ensure_store()
    return SECRET_FILE.read_text().strip().encode('utf-8')


def sign_session_payload(payload):
    body = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode('utf-8')
    signature = hmac.new(signing_secret(), body, hashlib.sha256).digest()
    return f'{b64url_encode(body)}.{b64url_encode(signature)}'


def create_session_token(difficulty):
    session = {
        'v': 1,
        'iat': time.time(),
        'sid': secrets.token_urlsafe(18),
        'difficulty': difficulty,
    }
    return sign_session_payload(session)


def parse_session_token(token):
    try:
        body_part, signature_part = str(token or '').split('.', 1)
        body = b64url_decode(body_part)
        signature = b64url_decode(signature_part)
    except Exception:
        return None
    expected = hmac.new(signing_secret(), body, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        session = json.loads(body.decode('utf-8'))
    except Exception:
        return None
    if not isinstance(session, dict) or session.get('v') != 1:
        return None
    return session


def validate_score_session(payload, entry, meta):
    session = parse_session_token(payload.get('session'))
    if session is None:
        return 'bad_session'
    sid = str(session.get('sid') or '')
    if not sid:
        return 'bad_session'
    if sid in meta.get('used_sessions', {}):
        return 'used_session'
    issued_at = float(session.get('iat') or 0)
    age = time.time() - issued_at
    if age < SESSION_MIN_AGE:
        return 'session_too_new'
    if age > SESSION_MAX_AGE:
        return 'session_expired'
    if session.get('difficulty') != entry['difficulty']:
        return 'bad_session_difficulty'
    allowed_score = min(MAX_SCORE, int(SESSION_SCORE_GRACE + age * SESSION_SCORE_PER_SECOND))
    if entry['score'] > allowed_score:
        return 'score_too_fast'
    meta.setdefault('used_sessions', {})[sid] = time.time() + SESSION_MAX_AGE
    return None


def normalize_china_region(region, region_code):
    code = str(region_code or '').strip().upper()
    if code.startswith('CN-'):
        code = code[3:]
    if code in CHINA_REGION_NAMES:
        return CHINA_REGION_NAMES[code]

    value = str(region or '').strip()
    if not value:
        return None
    normalized = value.lower().replace(' province', '').replace(' municipality', '').strip()
    if normalized in CHINA_REGION_ALIASES:
        return CHINA_REGION_ALIASES[normalized]
    for suffix in ('省', '市', '壮族自治区', '回族自治区', '维吾尔自治区', '自治区', '特别行政区'):
        if value.endswith(suffix):
            value = value[:-len(suffix)]
    if value in set(CHINA_REGION_NAMES.values()):
        return value
    return None


def normalize_lookup_region(country_code, region, region_code):
    country = str(country_code or '').strip().upper()
    if country == 'CN':
        return normalize_china_region(region, region_code) or UNKNOWN_CHINA_REGION
    if country:
        return COUNTRY_NAMES.get(country, country)
    return None


def json_get(url, timeout=IP_LOOKUP_TIMEOUT):
    request = urllib.request.Request(url, headers={'User-Agent': 'xuefeng-runner/1.0'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            return None
        return json.loads(response.read(4096).decode('utf-8', errors='replace'))


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
        label = clean_name(key)
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


def anonymized_lookup_ip(ip):
    try:
        address = ipaddress.ip_address(str(ip).strip())
    except ValueError:
        return ''
    if address.is_private or address.is_loopback or address.is_link_local or address.is_multicast or address.is_unspecified:
        return ''
    if address.version == 4:
        network = ipaddress.ip_network(f'{address}/24', strict=False)
        return str(network.network_address + 1)
    else:
        network = ipaddress.ip_network(f'{address}/48', strict=False)
        return str(network.network_address + 1)


def region_retry_key(region, ip):
    region = clean_region(region)
    retry_ip = anonymized_lookup_ip(ip)
    if not retry_ip or region not in {UNKNOWN_REGION, UNKNOWN_CHINA_REGION}:
        return ''
    return f'{region}\t{retry_ip}'


def compact_region_retry_counts(counts, max_items=MAX_REGION_RETRY_ITEMS):
    if not isinstance(counts, dict):
        return {}
    cleaned = []
    for key, value in counts.items():
        if '\t' not in str(key):
            continue
        region, ip = str(key).split('\t', 1)
        retry_key = region_retry_key(region, ip)
        count = clean_count(value)
        if retry_key and count is not None:
            cleaned.append((retry_key, count))
    cleaned.sort(key=lambda item: (-item[1], item[0]))
    return dict(cleaned[:max_items])


def remember_region_retry(meta, region, ip, count=1):
    key = region_retry_key(region, ip)
    clean = clean_count(count)
    if not key or clean is None:
        return
    retry_counts = meta.setdefault('region_retry_ips', {})
    retry_counts[key] = min(100000000, int(retry_counts.get(key, 0)) + clean)


def compact_used_sessions(sessions):
    now = time.time()
    if not isinstance(sessions, dict):
        return {}
    rows = []
    for key, value in sessions.items():
        try:
            expires_at = float(value)
        except Exception:
            continue
        if expires_at > now:
            rows.append((str(key)[:80], expires_at))
    rows.sort(key=lambda item: item[1], reverse=True)
    return dict(rows[:2000])


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
    region_retry_ips = (
        compact_region_retry_counts(meta.get('region_retry_ips', {}))
        if isinstance(meta.get('region_retry_ips'), dict)
        else {}
    )
    return {
        'total_games': max(total, len(rows)),
        'player_games': compact_counts(player_games),
        'region_stats': compact_region_counts(region_stats),
        'region_retry_ips': compact_region_retry_counts(region_retry_ips),
        'used_sessions': compact_used_sessions(meta.get('used_sessions', {})),
    }


def save_meta_unlocked(meta):
    payload = {
        'total_games': max(0, int(meta.get('total_games', 0))),
        'player_games': compact_counts(meta.get('player_games', {})),
        'region_stats': compact_region_counts(meta.get('region_stats', {})),
        'region_retry_ips': compact_region_retry_counts(meta.get('region_retry_ips', {})),
        'used_sessions': compact_used_sessions(meta.get('used_sessions', {})),
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


def public_ip(value):
    try:
        ip = ipaddress.ip_address(str(value).strip())
    except ValueError:
        return None
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified:
        return None
    return str(ip)


def client_ip(headers, client_address):
    candidates = [
        headers.get('CF-Connecting-IP'),
        headers.get('True-Client-IP'),
        headers.get('X-Real-IP'),
    ]
    forwarded_for = headers.get('X-Forwarded-For') or ''
    candidates.extend(part.strip() for part in forwarded_for.split(','))
    if client_address:
        candidates.append(str(client_address[0] or ''))
    for candidate in candidates:
        ip = public_ip(candidate)
        if ip:
            return ip
    return ''


def lookup_region_by_ip(ip):
    if not IP_LOOKUP_ENABLED or not ip:
        return None
    now = time.time()
    cached = IP_REGION_CACHE.get(ip)
    if cached and cached[1] > now:
        return cached[0]
    region = None
    escaped_ip = urllib.parse.quote(ip, safe='')
    lookups = (
        (
            f'https://ipapi.co/{escaped_ip}/json/',
            lambda payload: normalize_lookup_region(
                payload.get('country_code') or payload.get('country'),
                payload.get('region') or payload.get('region_name'),
                payload.get('region_code'),
            ),
        ),
        (
            f'http://ip-api.com/json/{escaped_ip}?fields=status,countryCode,region,regionName,country&lang=zh-CN',
            lambda payload: normalize_lookup_region(
                payload.get('countryCode'),
                payload.get('regionName') or payload.get('region'),
                payload.get('region'),
            ) if payload.get('status') == 'success' else None,
        ),
    )
    for url, parser in lookups:
        try:
            payload = json_get(url)
        except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        region = parser(payload)
        if region and region not in {UNKNOWN_REGION, UNKNOWN_CHINA_REGION}:
            break
    if region:
        IP_REGION_CACHE[ip] = (region, now + IP_LOOKUP_CACHE_TTL)
    return region


def client_region_detail(headers, client_address):
    country = (headers.get('CF-IPCountry') or '').strip().upper()
    region = headers.get('CF-Region') or headers.get('CF-IPRegion') or ''
    region_code = headers.get('CF-Region-Code') or headers.get('CF-IPRegion-Code') or ''
    if country == 'CN':
        header_region = normalize_china_region(region, region_code)
        if header_region:
            return header_region, ''
        ip = client_ip(headers, client_address)
        return lookup_region_by_ip(ip) or UNKNOWN_CHINA_REGION, ip
    if country and country not in {'XX', 'T1'}:
        return COUNTRY_NAMES.get(country, country), ''
    ip = client_ip(headers, client_address)
    if ip:
        return lookup_region_by_ip(ip) or UNKNOWN_REGION, ip
    if client_address and str(client_address[0] or '').startswith('127.'):
        return LOCAL_REGION, ''
    return UNKNOWN_REGION, ''


def client_region(headers, client_address):
    region, _ = client_region_detail(headers, client_address)
    return region


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
    rows.sort(key=lambda row: (row['region'] in {UNKNOWN_REGION, UNKNOWN_CHINA_REGION}, -row['games'], row['region']))
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
    server_version = 'XuefengRunnerAPI/1.4'

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
        path = self.path.split('?', 1)[0]
        if path == '/api/session':
            self.issue_session()
            return
        if path == '/api/name-check':
            self.check_name()
            return
        if path != '/api/leaderboard':
            self.send_json(404, {'error': 'not_found'})
            return
        ensure_store()
        with LOCK_FILE.open('r+') as lock:
            fcntl.flock(lock, fcntl.LOCK_SH)
            rows = load_scores_unlocked()
            meta = load_meta_unlocked(rows)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, leaderboard_payload(rows, meta))

    def issue_session(self):
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        difficulty = clean_difficulty((query.get('difficulty') or [''])[0])
        if difficulty is None:
            self.send_json(400, {'error': 'bad_difficulty'})
            return
        token = create_session_token(difficulty)
        self.send_json(200, {
            'ok': True,
            'session': token,
            'expires_in': SESSION_MAX_AGE,
        })

    def check_name(self):
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        raw_name = (query.get('name') or [''])[0]
        name = clean_name(raw_name)
        if name is None:
            self.send_json(200, {
                'ok': False,
                'error': 'bad_name',
                'reason': forbidden_name_reason(raw_name) or 'bad_name',
            })
            return
        self.send_json(200, {
            'ok': True,
            'name': name,
        })

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
            session_error = validate_score_session(payload, entry, meta)
            if session_error:
                fcntl.flock(lock, fcntl.LOCK_UN)
                self.send_json(400, {'error': session_error})
                return
            meta['total_games'] += 1
            meta['player_games'][entry['name']] = meta['player_games'].get(entry['name'], 0) + 1
            region, retry_ip = client_region_detail(self.headers, self.client_address)
            meta['region_stats'][region] = meta['region_stats'].get(region, 0) + 1
            remember_region_retry(meta, region, retry_ip)
            rows.append(entry)
            rows = best_scores(rows)
            save_scores_unlocked(rows)
            save_meta_unlocked(meta)
            fcntl.flock(lock, fcntl.LOCK_UN)
        self.send_json(200, {'ok': True, **leaderboard_payload(rows, meta)})


def reparse_region_retries():
    ensure_store()
    moved = {}
    unresolved = {}
    with LOCK_FILE.open('r+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        rows = load_scores_unlocked()
        meta = load_meta_unlocked(rows)
        retry_counts = compact_region_retry_counts(meta.get('region_retry_ips', {}))
        for key, count in retry_counts.items():
            from_region, ip = key.split('\t', 1)
            region = lookup_region_by_ip(ip)
            if region and region not in {UNKNOWN_REGION, UNKNOWN_CHINA_REGION}:
                current_unknown = int(meta['region_stats'].get(from_region, 0))
                move_count = min(current_unknown, count)
                if move_count > 0:
                    meta['region_stats'][from_region] = current_unknown - move_count
                    if meta['region_stats'][from_region] <= 0:
                        meta['region_stats'].pop(from_region, None)
                    meta['region_stats'][region] = meta['region_stats'].get(region, 0) + move_count
                    moved[region] = moved.get(region, 0) + move_count
                continue
            unresolved[key] = count
        meta['region_retry_ips'] = unresolved
        save_meta_unlocked(meta)
        fcntl.flock(lock, fcntl.LOCK_UN)
    return {
        'moved': moved,
        'unresolved': sum(unresolved.values()),
        'retry_items': len(unresolved),
    }


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--reparse-regions':
        print(json.dumps(reparse_region_retries(), ensure_ascii=False, sort_keys=True))
        raise SystemExit(0)
    ensure_store()
    server = ThreadingHTTPServer(('127.0.0.1', 8787), Handler)
    server.serve_forever()
