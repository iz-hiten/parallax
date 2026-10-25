"""Compose the score and sound-effects stems for the PARALLAX video.

Reads src/timeline.json so every hit lands on the frame its visual happens on.
Writes public/music.wav (ducked under the voiceover) and public/sfx.wav.
Everything is synthesised here, so there is nothing to license.
"""
import json, pathlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
FPS = TL["fps"]
N = int(TL["total"] / FPS * SR) + SR
rng = np.random.default_rng(7)
S = {s["name"]: s for s in TL["scenes"]}


def at(scene, key=None, off=0):
    """Absolute time in seconds of a scene cue."""
    s = S[scene]
    fr = s["start"] + (s["ev"][key] if key else 0) + off
    return fr / FPS


def T(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n, a, r, sustain=True):
    """Attack/release envelope in seconds over n samples."""
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr and sustain:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def add(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: len(buf) - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(sig), 0] += sig * gain * l * 1.414
    buf[i : i + len(sig), 1] += sig * gain * r * 1.414


def reverb(x, secs=2.2, wet=0.35, seed=1):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t / (secs / 5))[:, None]
    ir = np.stack([lp(ir[:, 0], 6000), lp(ir[:, 1], 5000)], 1)
    ir /= np.sqrt((ir**2).sum(0))
    out = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + out * wet


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def saw(f, t, ph=0.0):
    return 2 * ((f * t + ph) % 1) - 1


# ---------------- instruments ----------------
def pad_note(m, dur):
    t = T(dur)
    x = sum(saw(midi(m + d), t, rng.random()) for d in (-0.11, 0, 0.12)) / 3
    x = lp(x, 1400)
    return x * env(len(t), 1.2, 1.4)


def bass_note(m, dur):
    t = T(dur)
    f = midi(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    x = np.tanh(1.6 * x) * np.exp(-t / 0.35)
    return x * env(len(t), 0.005, 0.03)


def pluck(m, dur=0.5):
    t = T(dur)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.18)
    return x * env(len(t), 0.002, 0.02)


def kick():
    t = T(0.45)
    f = 45 + 85 * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return np.tanh(2.2 * x)


def hat(dec=0.035):
    t = T(0.12)
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t / dec)


def clap():
    t = T(0.3)
    n = bp(rng.standard_normal(len(t)), 900, 3500) * np.exp(-t / 0.07)
    return n


def impact(big=1.0):
    t = T(3.5)
    f = 30 + 70 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.7 * big))
    crack = lp(rng.standard_normal(len(t)), 5000) * np.exp(-t / 0.12)
    return np.tanh(1.8 * boom) * 0.9 + crack * 0.35


def riser(dur):
    t = T(dur)
    n = rng.standard_normal(len(t))
    k = len(t) // 8
    out = np.zeros(len(t))
    for i in range(8):  # stepped band-pass sweep reads as a rising whoosh
        seg = slice(i * k, (i + 1) * k if i < 7 else len(t))
        c = 300 * (12 ** (i / 7))
        out[seg] = bp(n, c * 0.7, min(c * 1.4, 18000))[seg]
    tone = np.sin(2 * np.pi * np.cumsum(200 * 2 ** (t / dur * 2.5)) / SR) * 0.25
    return (out + tone) * (t / dur) ** 2.2


def whoosh(dur=0.7, lo=250, hi=3200):
    t = T(dur)
    n = rng.standard_normal(len(t))
    a = bp(n, lo, lo * 3)
    b = bp(n, hi / 3, hi)
    mix = np.clip(t / dur, 0, 1)
    shape = np.sin(np.pi * t / dur) ** 2
    return (a * (1 - mix) + b * mix) * shape


def tick(f=2200, dec=0.012):
    t = T(0.05)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / dec)


def pop(f0=520, f1=880):
    t = T(0.14)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.02))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)


def bell(notes=(81, 88, 93), dur=2.2):
    t = T(dur)
    x = sum(np.sin(2 * np.pi * midi(m) * t) * np.exp(-t / (0.9 - 0.15 * i)) for i, m in enumerate(notes))
    x += 0.2 * np.sin(2 * np.pi * midi(notes[0]) * 2.76 * t) * np.exp(-t / 0.2)
    return x / len(notes)


def ping(hi=False):
    t = T(0.8)
    a = np.sin(2 * np.pi * (1318.5 if not hi else 1760) * t) * np.exp(-t / 0.18)
    b = np.sin(2 * np.pi * (1975.5 if not hi else 2637) * t) * np.exp(-(t - 0.07).clip(0) / 0.22) * (t > 0.07)
    return a * 0.6 + b * 0.5


def thud():
    t = T(0.6)
    f = 60 + 90 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14)
    return np.tanh(2 * x) + lp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.03) * 0.5


def key_click():
    t = T(0.04)
    return hp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.006)


# ---------------- score ----------------
BEAT = 0.6  # 100 bpm, one beat = 18 frames
BAR = BEAT * 4
# D minor: Dm - Bb - F - C, two bars each
PROG = [(50, [62, 65, 69]), (46, [58, 62, 65]), (53, [60, 65, 69]), (48, [60, 64, 67])]

music = np.zeros((N, 2))
pads = np.zeros((N, 2))

total_s = TL["total"] / FPS
drop = at("title", "drop")
groove_on = at("ledger")
tension_on = at("dash", "scrub") - 0.4
alert = at("dash", "alert")
calm_on = at("phone")
end_hit = at("end", "letters")
song_end = total_s

# pads: chord every 2 bars across the whole piece, voiced wider after the drop
t0 = 0.0
ci = 0
while t0 < song_end:
    root, chord = PROG[ci % 4]
    d = 2 * BAR + 1.4
    for m in chord:
        g = 0.16 if t0 < drop else 0.2
        add(pads, pad_note(m, d), t0, g, pan=(m % 3 - 1) * 0.5)
    add(pads, pad_note(root - 12, d), t0, 0.12)
    if t0 >= drop:
        add(pads, pad_note(chord[-1] + 12, d), t0, 0.06, pan=0.3)
    t0 += 2 * BAR
    ci += 1


def chord_at(t):
    return PROG[int(t // (2 * BAR)) % 4]


# heartbeat pulse during the cold open and trap
t = 2 * BAR
while t < drop - 3.2:
    add(music, kick() * 0.5, t, 0.35)
    add(music, kick() * 0.5, t + 0.3, 0.2)
    t += 2 * BEAT

# riser into the title drop, then the hit
add(music, riser(3.2), drop - 3.2, 0.32)
add(music, impact(1.4), drop, 0.9)
add(music, bell((74, 81, 86), 3.0), drop, 0.18)

# main groove: ledger -> just before the scrub, and again after the alert
def groove(a, b, energy=1.0):
    t = a
    step = 0
    while t < b:
        root, chord = chord_at(t)
        beat = step % 4
        if beat in (0, 2):
            add(music, kick(), t, 0.42 * energy)
        if beat in (1, 3) and energy > 0.9:
            add(music, clap(), t, 0.10 * energy, pan=0.1)
        add(music, hat(), t + BEAT / 2, 0.05 * energy, pan=0.35)
        if energy > 0.9:
            add(music, hat(0.02), t + BEAT * 0.75, 0.025 * energy, pan=-0.35)
        # bass on eighths
        for k in range(2):
            add(music, bass_note(root - 12, BEAT / 2), t + k * BEAT / 2, 0.24 * energy)
        # arpeggio: chord tones up an octave, eighth notes
        arp = chord + [chord[0] + 12]
        for k in range(2):
            m = arp[(step * 2 + k) % len(arp)] + 12
            add(pads, pluck(m), t + k * BEAT / 2, 0.07 * energy, pan=0.4 if k else -0.4)
        t += BEAT
        step += 1


groove(groove_on, tension_on, 0.85)

# tension: drums out, a ticking clock and a slow rise while the time machine scrubs back
t = tension_on
while t < alert:
    add(music, tick(3000, 0.008), t, 0.10, pan=0.2)
    add(music, tick(2000, 0.008), t + BEAT / 2, 0.06, pan=-0.2)
    t += BEAT
add(music, riser(min(3.0, alert - tension_on)), alert - min(3.0, alert - tension_on), 0.28)
add(music, impact(1.2), alert, 0.85)
add(music, bell((81, 85, 88), 2.6), alert, 0.22)

groove(alert + BEAT, calm_on, 1.0)
groove(calm_on, end_hit - 0.6, 0.55)
add(music, riser(1.8), end_hit - 1.8, 0.18)
add(music, impact(1.0), end_hit, 0.6)
add(music, bell((74, 81, 86), 3.5), end_hit, 0.2)

pads = reverb(pads, 2.6, 0.45, 2)
music = reverb(music, 1.4, 0.18, 3) + pads

# pad swell in at the start and fade out at the end
tt = np.arange(N) / SR
fade = np.clip(tt / 2.5, 0, 1) * np.clip((song_end - tt) / 4.0, 0, 1)
music *= fade[:, None]

# duck the score under every voiceover line
duck = np.ones(N)
for s in TL["scenes"]:
    for v in s["vo"]:
        a = (s["start"] + v["from"]) / FPS
        b = a + v["len"] / FPS
        duck[int(a * SR) : int(b * SR)] = 0.42
k = int(0.25 * SR)
c = np.concatenate([[0.0], np.cumsum(np.pad(duck, (k // 2, k - k // 2), mode="edge"))])
duck = (c[k:] - c[:-k])[: len(duck)] / k  # moving average via cumulative sum
music *= duck[:, None]

# ---------------- sound effects ----------------
sfx = np.zeros((N, 2))
names = [s["name"] for s in TL["scenes"]]
for nm in names[1:]:
    add(sfx, whoosh(0.8), at(nm) - 0.35, 0.22, pan=0)

# open
add(sfx, riser(1.4) * 0.6, 0.1, 0.25)
for i in range(4):
    add(sfx, pop(700, 1100), at("open", "prices", i * 6), 0.12, pan=-0.3 + i * 0.2)
# trap
add(sfx, pop(), at("trap", off=14), 0.15, -0.4)
add(sfx, pop(), at("trap", off=24), 0.15, 0.4)
add(sfx, pop(400, 1200), at("trap", "pill"), 0.22)
add(sfx, thud(), at("trap", "strike", 4), 0.35)
add(sfx, whoosh(0.35, 1500, 6000), at("trap", "strike"), 0.15)
for i in range(3):
    add(sfx, pop(600, 950), at("trap", "chips", i * 22), 0.13, pan=-0.4 + i * 0.4)
# ledger
for i in range(4):
    add(sfx, pop(500, 760), at("ledger", "rows", i * 30), 0.1, pan=-0.2)
    add(sfx, tick(2600), at("ledger", "rows", i * 30 + 40), 0.12, pan=0.2)
add(sfx, riser(1.6) * 0.5, at("ledger", "morph") - 0.2, 0.2)
add(sfx, bell((86, 93), 1.2), at("ledger", "morph", 45), 0.08)
# carry
add(sfx, whoosh(1.8, 200, 2000), at("carry", "draw"), 0.12)
add(sfx, pop(), at("carry", "points"), 0.12)
add(sfx, pop(), at("carry", "points", 10), 0.12)
add(sfx, whoosh(1.4, 300, 1500), at("carry", "slide"), 0.18, pan=-0.3)
add(sfx, pop(700, 1000), at("carry", "label"), 0.12)
# witness
for i in range(4):
    add(sfx, pop(480, 720), at("witness", off=30 + i * 14), 0.11, pan=-0.5 + i * 0.33)
    add(sfx, pluck(74 + [0, 3, 7, 10][i], 0.6) * 0.8, at("witness", "markers", i * 8), 0.14, pan=-0.5 + i * 0.33)
add(sfx, thud() * 0.6, at("witness", "consensus", 38), 0.25)
add(sfx, tick(1800, 0.02), at("witness", "consensus", 38), 0.2)
# moat
for i, key in enumerate(["bar0", "bar1", "bar2", "bar3"]):
    add(sfx, pop(380 + i * 80, 700 + i * 80), at("moat", key), 0.15, pan=-0.5 + i * 0.33)
add(sfx, whoosh(1.3, 400, 2500), at("moat", "line"), 0.14)
add(sfx, thud(), at("moat", "stamp", 2), 0.55)
add(sfx, impact(0.6) * 0.5, at("moat", "stamp", 2), 0.3)
# dashboard
add(sfx, whoosh(1.0, 150, 1800), at("dash"), 0.25)
for start in (at("dash", "receipt"), at("dash", "alert", 6)):
    t = start
    while t < start + 3.0:
        add(sfx, key_click(), t, 0.05, pan=rng.uniform(-0.3, 0.3))
        t += rng.uniform(0.045, 0.09)
add(sfx, tick(1500, 0.01), at("dash", "scrub", -8), 0.2)
add(sfx, whoosh(3.6, 2500, 400)[::-1], at("dash", "scrub"), 0.1)
add(sfx, whoosh(0.6, 600, 4000), at("dash", "card"), 0.2, pan=0.4)
add(sfx, tick(1500, 0.01), at("dash", "cursorCard"), 0.2)
# attribution
for i, key in enumerate(["bar0", "bar1", "bar2", "bar3"]):
    add(sfx, pop(450 + i * 60, 800 + i * 60), at("attr", key), 0.14)
for i in range(12):
    add(sfx, tick(2400 + i * 60, 0.01), at("attr", "net", i * 3), 0.07)
add(sfx, bell((86, 90, 93), 1.2), at("attr", "net", 40), 0.08)
# phone
add(sfx, whoosh(0.9, 200, 2500), at("phone"), 0.2, pan=0.4)
add(sfx, ping(), at("phone", "b0"), 0.2, 0.4)
add(sfx, ping(), at("phone", "b1"), 0.2, 0.4)
add(sfx, ping(True), at("phone", "b2"), 0.28, 0.4)

sfx = reverb(sfx, 1.0, 0.15, 4)


def write(name, x, peak_db):
    x = x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    wavfile.write(str(ROOT / "public" / name), SR, (x * 32767).astype(np.int16))
    rms = 20 * np.log10(np.sqrt((x**2).mean()) + 1e-9)
    print(f"{name}: {len(x)/SR:.1f}s  peak {peak_db} dBFS  rms {rms:.1f} dBFS")


write("music.wav", music, -7.5)
write("sfx.wav", sfx, -8.0)
