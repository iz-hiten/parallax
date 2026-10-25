"""Download MCX daily bhavcopies (gold contracts only) through a real Chrome session.

MCX sits behind bot protection that rejects plain HTTP clients, so this drives the
installed Chrome with Playwright and calls the same endpoint the bhavcopy page uses.

Usage:  python data/fetch_mcx.py 2023-01-01 2026-10-20
Each trading day is saved to data/raw/YYYY-MM-DD.json. Days already saved are skipped,
so the script can be stopped and resumed. Holidays are recorded in data/raw/_skipped.json.
"""
import asyncio, json, pathlib, sys
from datetime import date, timedelta
from playwright.async_api import async_playwright

RAW = pathlib.Path(__file__).resolve().parent / "raw"
GOLD = {"GOLD", "GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"}
URL = "/market-data/bhavcopy/GetDateWiseBhavCopy?InstrumentName=FUTCOM&fromDate="


async def main(start: date, end: date):
    RAW.mkdir(parents=True, exist_ok=True)
    skipped_path = RAW / "_skipped.json"
    skipped = json.loads(skipped_path.read_text()) if skipped_path.exists() else {}
    days = [start + timedelta(d) for d in range((end - start).days + 1)]
    todo = [d for d in days if d.weekday() < 5 and not (RAW / f"{d}.json").exists() and str(d) not in skipped]
    print(f"{len(todo)} weekdays to fetch", flush=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=False,
                                    args=["--disable-blink-features=AutomationControlled", "--window-position=-2000,0"])
        page = await (await b.new_context(locale="en-IN")).new_page()
        await page.goto("https://www.mcxindia.com/market-data/bhavcopy", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2500)
        for i, d in enumerate(todo):
            req = d.strftime("%d/%m/%Y")
            for attempt in range(3):
                try:
                    res = await page.evaluate(
                        """async (u) => { const r = await fetch(u, {headers: {'Content-Type': 'application/json'}});
                                          return [r.status, await r.text()]; }""", URL + req)
                    break
                except Exception as e:  # page navigated or network blip: reload and retry
                    print("retry", d, e, flush=True)
                    await page.goto("https://www.mcxindia.com/market-data/bhavcopy", wait_until="domcontentloaded", timeout=60000)
                    await page.wait_for_timeout(3000)
            status, text = res
            if status != 200:
                print(d, "HTTP", status, "- pausing", flush=True)
                await page.wait_for_timeout(20000)
                continue
            body = json.loads(text)
            rows = body.get("Data") or []
            # MCX can answer an unknown/holiday date with another day's file; keep only exact matches
            want = d.strftime("%m/%d/%Y")
            gold = [r for r in rows if r.get("Symbol", "").strip() in GOLD]
            returned = {r.get("Date") for r in rows}
            if not rows or want not in returned:
                skipped[str(d)] = body.get("Message") if not rows else f"returned {sorted(returned)}"
                skipped_path.write_text(json.dumps(skipped, indent=1))
            else:
                (RAW / f"{d}.json").write_text(json.dumps([r for r in gold if r.get("Date") == want]))
            if i % 25 == 0:
                print(f"{i+1}/{len(todo)} {d} gold rows={len(gold)}", flush=True)
            await page.wait_for_timeout(900)
        await b.close()
    print("done", flush=True)


if __name__ == "__main__":
    a = date.fromisoformat(sys.argv[1]); z = date.fromisoformat(sys.argv[2])
    asyncio.run(main(a, z))
