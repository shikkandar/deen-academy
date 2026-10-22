#!/usr/bin/env python3
"""Builds the Namaz Assistant clips in assets/sounds/salah/ (macOS: needs afconvert).

Sources:
- Hisn al-Muslim recitations (hisnmuslim.com/audio/ar/{id}.mp3). Each one starts with a spoken chapter title and
  "yaqul", and some end with "thalatha marrat", so only the supplication itself is cut out (times below, found by
  transcribing each file and splitting at its pauses).
- Alafasy's ta'awwudh and bismillah (everyayah.com).
- iqamah, takbir, salam, ameen: Gemini TTS, Charon voice (scripts/gemini-tts.mjs), trimmed to the speech automatically.

    python3 scripts/build-salah-audio.py <work dir>

Writes <name>.m4a (AAC, mono) for every clip, a 2-minute silent dua gap, and assets/data/salah-clips.json with the
length of each clip in seconds.
"""

import array
import json
import math
import os
import subprocess
import sys
import urllib.request
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sounds/salah')
HOME = os.path.expanduser('~')

# name: (source, start s, end s)  — None end = to the end of the speech
CLIPS = {
    'iqamah': (f'{HOME}/Downloads/salah-voices/iqamah-Charon-1.wav', None, None),
    'takbir': (f'{HOME}/Downloads/salah-voices/takbir-Charon-2.wav', None, None),
    'sana': ('https://www.hisnmuslim.com/audio/ar/28.mp3', 0.66, 11.66),
    'taawwudh': ('https://everyayah.com/data/Alafasy_128kbps/audhubillah.mp3', 0.52, 6.70),
    'bismillah': ('https://everyayah.com/data/Alafasy_128kbps/bismillah.mp3', 0.20, 6.14),
    'ruku': ('https://www.hisnmuslim.com/audio/ar/33.mp3', 5.39, 7.64),
    'sami': ('https://www.hisnmuslim.com/audio/ar/38.mp3', 5.48, 7.56),
    'rabbana': ('https://www.hisnmuslim.com/audio/ar/39.mp3', 0.34, 6.88),
    'sujood': ('https://www.hisnmuslim.com/audio/ar/41.mp3', 4.94, 7.22),
    'jalsa': ('https://www.hisnmuslim.com/audio/ar/48.mp3', 7.10, 10.54),
    'tashahhud': ('https://www.hisnmuslim.com/audio/ar/52.mp3', 5.45, 32.68),
    'salawat': ('https://www.hisnmuslim.com/audio/ar/53.mp3', 9.42, 36.70),
    'closing': ('https://www.hisnmuslim.com/audio/ar/57.mp3', 1.00, 16.96),
    'qunut': ('https://www.hisnmuslim.com/audio/ar/116.mp3', 6.02, 42.67),
    'salam': (f'{HOME}/Downloads/salah-voices/salam-Charon.wav', 0.46, 3.94),
}
OPTIONAL = {'ameen': (f'{HOME}/Downloads/salah-voices/ameen-short-Charon-1.wav', None, None)}

RATE = 22050
PAD = 0.12  # seconds of air kept around each cut
GAP_SECONDS = 120


def fetch(src, work):
    if not src.startswith('http'):
        return src
    dest = os.path.join(work, src.rsplit('/', 2)[-2] + '-' + src.rsplit('/', 1)[-1])
    if not os.path.exists(dest):
        req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'wb') as f:
            f.write(r.read())
    return dest


def to_wav(src, dest):
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{RATE}', '-c', '1', src, dest], check=True)
    w = wave.open(dest)
    samples = array.array('h', w.readframes(w.getnframes()))
    w.close()
    return samples


def write_wav(path, samples):
    w = wave.open(path, 'wb')
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(samples.tobytes())
    w.close()


def to_m4a(wav_path, m4a_path):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', wav_path, m4a_path], check=True)


def speech_bounds(samples, threshold_db=-40):
    """First and last 10 ms window louder than the threshold, in seconds."""
    win = RATE // 100
    loud = []
    for i in range(0, len(samples), win):
        c = samples[i:i + win]
        rms = math.sqrt(sum(x * x for x in c) / max(1, len(c)))
        loud.append(20 * math.log10(max(rms, 1) / 32768) > threshold_db)
    first = loud.index(True)
    last = len(loud) - 1 - loud[::-1].index(True)
    return first / 100, (last + 1) / 100


def cut(samples, start, end):
    if start is None:
        start, end = speech_bounds(samples)
    a = max(0, int((start - PAD) * RATE))
    b = len(samples) if end is None else min(len(samples), int((end + PAD) * RATE))
    clip = samples[a:b]
    # normalise to -1 dBFS, with 25 ms fades so cuts don't click
    peak = max(1, max(abs(x) for x in clip))
    gain = (32767 * 10 ** (-1 / 20)) / peak
    fade = int(0.025 * RATE)
    out = array.array('h')
    for i, x in enumerate(clip):
        f = min(1.0, i / fade, (len(clip) - 1 - i) / fade)
        out.append(max(-32768, min(32767, int(x * gain * f))))
    return out


def main():
    work = sys.argv[1] if len(sys.argv) > 1 else '/tmp/salah-audio'
    os.makedirs(work, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    lengths = {}
    clips = dict(CLIPS)
    clips.update({k: v for k, v in OPTIONAL.items() if os.path.exists(v[0])})
    for name, (src, start, end) in clips.items():
        raw = to_wav(fetch(src, work), os.path.join(work, name + '-raw.wav'))
        clip = cut(raw, start, end)
        tmp = os.path.join(work, name + '.wav')
        write_wav(tmp, clip)
        to_m4a(tmp, os.path.join(OUT, name + '.m4a'))
        lengths[name] = round(len(clip) / RATE, 2)
        print(f'{name:10} {lengths[name]:6.2f}s')

    # 2 s of silence after every takbir, time to move into the next position
    pause = os.path.join(work, 'pause.wav')
    write_wav(pause, array.array('h', [0]) * (2 * RATE))
    to_m4a(pause, os.path.join(OUT, 'pause.m4a'))
    lengths['pause'] = 2

    silent = os.path.join(work, 'dua-gap.wav')
    write_wav(silent, array.array('h', [0]) * (GAP_SECONDS * RATE))
    to_m4a(silent, os.path.join(OUT, 'dua-gap.m4a'))
    lengths['dua-gap'] = GAP_SECONDS

    with open(os.path.join(ROOT, 'assets/data/salah-clips.json'), 'w') as f:
        json.dump(lengths, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
