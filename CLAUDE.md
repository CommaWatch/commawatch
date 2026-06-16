# CommaWatch

A single-page web app that tracks the real-time net worth of billionaires, styled as a
stock-ticker dashboard (the "how many commas?" / 4-commas trillionaire theme).

## Architecture

The project is intentionally tiny — no framework, no build step:

- `index.html` — the entire frontend: markup, CSS, and vanilla JS. Holds the hard-coded
  roster of tracked individuals and their holdings, the net-worth math, the canvas chart,
  type-ahead search, and a built-in random-walk price simulator (Demo mode) so the page
  always looks alive when the market is closed or no backend is connected.
- `api/quotes.js` — a Vercel serverless function at `/api/quotes`. It proxies stock quotes
  from Finnhub server-side, keeping the API key (`FINNHUB_API_KEY` env var) hidden from
  visitors. The frontend polls it every 15s and seamlessly switches from simulated to real
  data when quotes are available.

Net worth = Σ(live shares × real price) + private/static asset estimates. Stock options are
valued as `max(0, price − strike) × shares`.

## Deployment

Deploys to **commawatch.com** via **Vercel on every push to `main`**. There is no separate
release step — pushing to `main` ships to production. Treat `main` as live.

## Brand colors

| Token   | Hex       | Use                          |
|---------|-----------|------------------------------|
| Obsidian| `#0A0E0C` | Background / base            |
| Brass gold | `#E8B84B` | Accent, logo, highlights  |
| Gain green | `#36D399` | Positive change           |
| Loss coral | `#FF6B6B` | Negative change           |

These are defined as CSS custom properties (`--obsidian`, `--brass`, `--gain`, `--loss`) in
`index.html`. Reuse the tokens rather than hard-coding new hex values.

## Data integrity rule (important)

**Private holdings and share counts must stay clearly labeled as estimates until verified.**
Anything that is not a live, public market price — private companies (e.g. Blue Origin),
real estate, sports teams, and any unconfirmed share count — must carry a visible estimate
label (the `est` badge / `kind` tag and a `src` note) and must never be presented as a
confirmed live figure. Only positions with `kind: "live"` may show the `LIVE` badge. Do not
remove or weaken these labels until the underlying number is independently verified.
