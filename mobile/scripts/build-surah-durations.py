#!/usr/bin/env python3
"""Measures how long each surah takes in Alafasy's recitation, for the Namaz Assistant's surah picker (macOS: afinfo).

Covers Al-Fatiha and the surahs usually recited in salah: Juz Amma (78-114) and a few longer ones. Writes
assets/data/surah-durations.json: {"<surah>": {"name": ..., "ayahs": [global ayah numbers], "seconds": ...}}.

    python3 scripts/build-surah-durations.py <work dir>
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SURAHS = [1, 32, 36, 55, 56, 67, 71, 72, 73, 75, 76, 77] + list(range(78, 115))
AUDIO = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/{}.mp3'


def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def length(work, n):
    path = os.path.join(work, f'{n}.mp3')
    if not os.path.exists(path):
        req = urllib.request.Request(AUDIO.format(n), headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())
    out = subprocess.run(['afinfo', path], capture_output=True, text=True).stdout
    return float(re.search(r'estimated duration: ([0-9.]+)', out).group(1))


def main():
    work = sys.argv[1] if len(sys.argv) > 1 else '/tmp/surah-audio'
    os.makedirs(work, exist_ok=True)
    result = {}
    with ThreadPoolExecutor(8) as pool:
        for s in SURAHS:
            data = get_json(f'https://api.alquran.cloud/v1/surah/{s}')['data']
            ayahs = [a['number'] for a in data['ayahs']]
            seconds = sum(pool.map(lambda n: length(work, n), ayahs))
            result[str(s)] = {'name': data['englishName'], 'ayahs': ayahs, 'seconds': round(seconds, 1)}
            print(f"{s:3} {data['englishName']:20} {len(ayahs):3} ayahs {seconds:7.1f}s", flush=True)
    with open(os.path.join(ROOT, 'assets/data/surah-durations.json'), 'w') as f:
        json.dump(result, f, separators=(',', ':'))
        f.write('\n')


if __name__ == '__main__':
    main()
