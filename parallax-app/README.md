# Parallax

Relative-value intelligence for MCX gold futures. Parallax reads the exchange's daily bhavcopy, restates
GOLD, GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL on one scale (₹ per 10 g of 999 gold, bridged to the same
delivery date), and flags a contract only when its dislocation is unusual for that contract and larger than
the full cost of trading it. A walk-forward backtest on unseen data reports whether that survives costs.

One Next.js app: landing page, the app (`/app`), and the API, deployable to Vercel as is.

## What is in the box

| Path | What it does |
|---|---|
| `data/raw/` | One JSON file per trading day from MCX (gold futures rows only), 2 Jan 2023 onward |
| `data/market.json` | The packed dataset the app ships with |
| `lib/engine/daily.ts` | Normalisation, carry fit, witness weights, consensus, dislocation, cost moat, signals, receipts |
| `lib/engine/backtest.ts` | Next-open execution, costs, attribution, walk-forward folds, shuffled-entry test |
| `lib/engine/costs.ts` | Brokerage, exchange charge, SEBI fee, CTT, stamp duty, GST and slippage model |
| `lib/parse.ts` | Reads the CSV / XLS / JSON that mcxindia.com gives you |
| `app/` | Landing page, `/app` pages and `/api` routes |

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Without Firebase keys everything works except sign-in, uploads and saved alert rules.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repository. Framework is detected as Next.js; no build settings to change.
3. Add the environment variables below (Project → Settings → Environment Variables), then deploy.

## Firebase setup (free Spark plan, about 5 minutes)

1. Go to https://console.firebase.google.com and **Create a project** (Google Analytics can be off).
2. **Build → Firestore Database → Create database**, production mode, region `asia-south1` (Mumbai).
   Open the **Rules** tab, paste the contents of `firestore.rules`, and publish. Browsers never talk to
   Firestore directly; only the app's server does.
3. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
   Under **Settings → Authorized domains**, add your Vercel domain (for example `parallax-yourname.vercel.app`).
4. **Project settings (gear) → General → Your apps → Web (`</>`)**, register an app, and copy the config into:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
   ```

5. **Project settings → Service accounts → Generate new private key.** Base64-encode the downloaded file and
   store it as `FIREBASE_SERVICE_ACCOUNT_BASE64`:

   ```powershell
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json")) | Set-Clipboard
   ```

   ```bash
   # macOS / Linux
   base64 -w0 service-account.json      # macOS: base64 -i service-account.json
   ```

6. Redeploy on Vercel. `/api/health` should now report `"database": "connected"`.

For local development with Firebase, put the same variables in `.env.local`.

## Keeping the data current

Users can add any new trading day from **Data** in the app: download that day's bhavcopy CSV from
mcxindia.com (Market data → Bhavcopy) and drop it in. It is checked, saved to Firestore and included in every
user's analysis straight away.

To extend the bundled history instead (needs Python, `pip install playwright`, and Google Chrome):

```bash
python data/fetch_mcx.py 2026-10-21 2026-12-31   # resumes where it left off; holidays are logged
npm run data:build                                # repacks data/market.json
```

MCX's site rejects scripted HTTP clients, so the fetcher drives a real Chrome window. It requests each date in
DD/MM/YYYY, keeps only rows whose returned date (MM/DD/YYYY) equals the requested one, and records holidays in
`data/raw/_skipped.json`.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/today?date=YYYY-MM-DD` | One evening's analysis, using only data known that evening |
| `GET /api/backtest` | Walk-forward result; any cost field can be overridden, e.g. `?slipFloorBp=0.5` |
| `GET /api/export` | Every gold futures row as CSV |
| `GET /api/health` | Data range and database status |
| `POST /api/upload` | Add a bhavcopy day (signed-in users) |
| `GET/POST/DELETE /api/rules` | A signed-in user's alert rules and their historical matches |

## Method notes

- Contracts are always tracked by expiry date. There is no continuous near-month series.
- A contract with zero volume keeps MCX's settlement price but gets a witness weight of 0.02.
- Carry is fitted each evening across every credible print of every family, with a separate level per family,
  and smoothed over the last three fitted evenings.
- A signal needs a z-score of at least 3 against the contract's own trailing basis, a witness weight of at least
  0.4, a dislocation larger than the round-trip cost of both legs, and the contract outside its tender window
  (final 5 sessions).
- Pairs are hedged with the GOLDM (or, for GOLDM, GOLD) contract whose expiry is closest, sized to match fine gold.
- Backtest trades fill at the next session's open on the exact contracts named, and every trade's P&L is split
  exactly into gold exposure, roll-down, curve change, convergence and costs.

Parallax is an analytical tool, not investment advice. Settlement prices are exchange values, not guaranteed fills.
