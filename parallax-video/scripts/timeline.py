"""Build the master timeline (scene lengths, voice placements, visual cues) from the voiceover lengths.

Everything that has to line up - visuals, voice, music hits, sound effects - reads its frame numbers
from src/timeline.json, which this script writes.
"""
import json, math, pathlib

FPS = 30
OVERLAP = 14
ROOT = pathlib.Path(__file__).resolve().parent.parent
VO = json.loads((ROOT / "scripts" / "vo.json").read_text())


def f(sec):
    return math.ceil(sec * FPS)


def place(scene, after_gap=8):
    """Place a scene's lines: each at its anchor or after the previous line, whichever is later."""
    out, end = [], 0
    for ln in VO[scene]:
        start = max(ln["anchor"] or 0, end + after_gap if out else (ln["anchor"] or 0))
        out.append({"id": ln["id"], "from": start, "len": f(ln["dur"])})
        end = start + f(ln["dur"])
    return out


scenes = []

# 1. open
v = place("open", 6)
o2 = v[1]["from"]
scenes.append(dict(name="open", vo=v, ev=dict(split=o2 - 30, four=o2, prices=o2 + 4),
                   dur=max(190, v[-1]["from"] + v[-1]["len"] + 18)))
# 2. trap
v = place("trap")
t2 = v[1]["from"]
scenes.append(dict(name="trap", vo=v, ev=dict(pill=60, strike=t2 + 4, chips=t2 + 62, final=t2 + 150),
                   dur=v[-1]["from"] + v[-1]["len"] + 30))
# 3. title
v = place("title", 4)
scenes.append(dict(name="title", vo=v, ev=dict(drop=46, tagline=v[1]["from"]),
                   dur=max(165, v[-1]["from"] + v[-1]["len"] + 28)))
# 4. ledger
v = place("ledger")
l2 = v[1]["from"]
scenes.append(dict(name="ledger", vo=v, ev=dict(rows=50, morph=l2, formula=l2 + 55, caption=l2 + 70),
                   dur=v[-1]["from"] + v[-1]["len"] + 40))
# 5. carry
v = place("carry")
c2 = v[1]["from"]
scenes.append(dict(name="carry", vo=v, ev=dict(draw=40, points=95, guide=c2, slide=c2 + 45, label=c2 + 100, caption=c2 + 190),
                   dur=v[-1]["from"] + v[-1]["len"] + 30))
# 6. witness
v = place("witness")
w2 = v[1]["from"]
scenes.append(dict(name="witness", vo=v, ev=dict(axis=w2 - 10, markers=w2, consensus=w2 + 150, caption=w2 + 225),
                   dur=v[-1]["from"] + v[-1]["len"] + 30))
# 7. moat
v = place("moat")
m2 = v[1]["from"]
scenes.append(dict(name="moat", vo=v, ev=dict(bar0=60, bar1=125, bar2=170, bar3=215, line=m2 + 4, costs=m2 + 20, stamp=m2 + 82),
                   dur=v[-1]["from"] + v[-1]["len"] + 30))
# 8. dashboard: the scrub, alert and trade card follow the narration
d = VO["dash"]
d1 = 20
scrub = d1 + f(d[0]["dur"]) + 6
d2 = scrub
alert = d2 + f(d[1]["dur"]) + 4
d3 = alert + 14
card = d3 + f(d[2]["dur"]) - 6
d4 = card + 8
v = [{"id": d[0]["id"], "from": d1, "len": f(d[0]["dur"])},
     {"id": d[1]["id"], "from": d2, "len": f(d[1]["dur"])},
     {"id": d[2]["id"], "from": d3, "len": f(d[2]["dur"])},
     {"id": d[3]["id"], "from": d4, "len": f(d[3]["dur"])}]
dd = d4 + f(d[3]["dur"]) + 36
scenes.append(dict(name="dash", vo=v, ev=dict(receipt=60, scrub=scrub, scrubLen=110, alert=alert, card=card, cursorCard=card + 40), dur=dd))
# 9. attribution
v = place("attr")
a2 = v[1]["from"]
scenes.append(dict(name="attr", vo=v, ev=dict(bar0=a2, bar1=a2 + 30, bar2=a2 + 62, bar3=a2 + 98, net=a2 + 175, caption=a2 + 250),
                   dur=v[-1]["from"] + v[-1]["len"] + 30))
# 10. phone
v = place("phone")
scenes.append(dict(name="phone", vo=v, ev=dict(b0=40, b1=80, b2=125), dur=max(240, v[-1]["from"] + v[-1]["len"] + 40)))
# 11. end
v = place("end")
scenes.append(dict(name="end", vo=v, ev=dict(letters=30, tagline=70), dur=max(210, v[-1]["from"] + v[-1]["len"] + 50)))

t = 0
for s in scenes:
    s["start"] = t
    t += s["dur"] - OVERLAP
total = scenes[-1]["start"] + scenes[-1]["dur"]
out = {"fps": FPS, "overlap": OVERLAP, "total": total, "scenes": scenes}
(ROOT / "src" / "timeline.json").write_text(json.dumps(out, indent=1))
for s in scenes:
    print(f'{s["name"]:8s} start {s["start"]:5d}  dur {s["dur"]:5d}')
print("total", total, "frames =", round(total / FPS, 1), "s")
