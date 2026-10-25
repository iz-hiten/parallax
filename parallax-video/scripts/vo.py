"""Generate the voiceover clips with edge-tts and record their lengths in vo.json."""
import asyncio, json, pathlib, sys
import edge_tts
from mutagen.mp3 import MP3

VOICE = "en-US-AvaMultilingualNeural"
RATE = "+4%"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "vo"

# scene -> list of (id, anchor frame inside the scene or None to chain, text)
LINES = {
    "open": [
        ("open1", 12, "India's commodity exchange lists gold in four contract sizes."),
        ("open2", 100, "Same metal. Four different prices."),
    ],
    "trap": [
        ("trap1", 14, "Put two of them side by side, and Gold Ten looks point three six percent more expensive than Gold M."),
        ("trap2", 130, "But that gap isn't real. Purity, expiry date, and gram size explain almost all of it."),
    ],
    "title": [
        ("title1", 48, "This is Parallax."),
        ("title2", 92, "It measures only the gap that's honest."),
    ],
    "ledger": [
        ("ledger1", 18, "Step one. The Fine-Gram Ledger. Every contract is restated as rupees per ten grams of pure, nine nine nine gold."),
        ("ledger2", 175, "Four wildly different numbers collapse into one unit."),
    ],
    "carry": [
        ("carry1", 18, "Step two. The Carry Bridge. Gold M delivers about eight days later, so its price carries extra interest."),
        ("carry2", 140, "We fit tonight's futures curve, and slide every price to the same delivery date. Roll-down is mechanical. Whatever survives is information."),
    ],
    "witness": [
        ("witness1", 18, "Step three. Witness Weighting. A contract that barely traded shouldn't get to move the truth."),
        ("witness2", 150, "Volume, open interest and time to expiry set each contract's credibility. The consensus is a weighted median, so one thin print can't drag it."),
    ],
    "moat": [
        ("moat1", 18, "Step four. The Cost Moat. Add back carry, strip out purity, and the real dislocation is just nine basis points."),
        ("moat2", 160, "Trading it would cost eighteen. So Parallax stays quiet, and writes a receipt explaining why."),
    ],
    "dash": [
        ("dash1", 20, "Every evening, when the new bhav copy lands, Parallax rebuilds the screen. Most nights, the answer is: quiet."),
        ("dash2", None, "The time machine replays any past evening, using only what was published that day. No look-ahead."),
        ("dash3", None, "On September twenty third, Gold Guinea settled twenty seven basis points below consensus, with a strong witness, clearing a fourteen point moat."),
        ("dash4", None, "The signal arrives sized. Buy five Guinea, sell four Gold Ten. Forty grams of gold on each side, so the gold price cancels out."),
    ],
    "attr": [
        ("attr1", 16, "And when a trade makes money, we ask why."),
        ("attr2", 80, "Gold exposure, roll-down, convergence and costs are counted separately. Only convergence is credited to the strategy. And if it fails our pre-registered test, we publish the null result."),
    ],
    "phone": [
        ("phone1", 20, "Quiet most evenings. Loud only when it counts. Even a silent day gets a receipt."),
    ],
    "end": [
        ("end1", 40, "Parallax. One metal. Four prices. Only the honest gap."),
    ],
}

async def main(only=None):
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for scene, lines in LINES.items():
        meta[scene] = []
        for lid, anchor, text in lines:
            path = OUT / f"{lid}.mp3"
            if only is None or lid in only or not path.exists():
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))
            meta[scene].append({"id": lid, "anchor": anchor, "dur": round(MP3(str(path)).info.length, 3), "text": text})
            print(f"{lid:10s} {meta[scene][-1]['dur']:6.2f}s")
    (ROOT / "scripts" / "vo.json").write_text(json.dumps(meta, indent=1))

asyncio.run(main(set(sys.argv[1:]) or None))
