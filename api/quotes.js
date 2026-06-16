// CommaWatch — price fetcher (Vercel serverless function)
// Lives at /api/quotes. The page calls it like:  /api/quotes?symbols=TSLA,ORCL,AMZN
// It asks Finnhub for each ticker's price and returns them as JSON.
// Your secret API key stays here on the server and is never shown to visitors.
//
// Optional &period=day|wtd|mtd|ytd  (default: day)
//   day            -> just the live quote (change is measured vs the quote's prevClose `pc`)
//   wtd|mtd|ytd    -> additionally returns `ref`, the period-start reference price, pulled
//                     from Finnhub's daily candle endpoint, so the page can compute each
//                     person's net worth at the start of the week / month / year.

const DAY = 86400;

// Start of the selected period, as a UNIX epoch (seconds), in UTC.
// wtd = most recent Monday; mtd = 1st of this month; ytd = Jan 1.
function periodStartEpoch(period) {
  const now = new Date();
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "wtd") {
    const diff = (d.getUTCDay() + 6) % 7; // days since Monday
    d.setUTCDate(d.getUTCDate() - diff);
  } else if (period === "mtd") {
    d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (period === "ytd") {
    d = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  return Math.floor(d.getTime() / 1000);
}

// The reference price = the close of the last trading day BEFORE the period started
// (the baseline the period's change is measured against). Falls back to the first
// in-period close, then the latest close. Returns null if no usable candle data.
async function refPrice(sym, from, to, start, key) {
  try {
    const url =
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(sym)}` +
      `&resolution=D&from=${from}&to=${to}&token=${key}`;
    const r = await fetch(url);
    const d = await r.json();
    if (!d || d.s !== "ok" || !Array.isArray(d.c) || !d.c.length) return null;
    let ref = null;
    for (let i = 0; i < d.t.length; i++) {
      if (d.t[i] < start) {
        ref = d.c[i]; // keep last close before the period start
      } else {
        if (ref == null) ref = d.c[i]; // no prior close available — use first in-period
        break;
      }
    }
    if (ref == null) ref = d.c[d.c.length - 1];
    return ref;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "FINNHUB_API_KEY is not set in Vercel." });
  }

  const symbols = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  const period = String(req.query.period || "day").toLowerCase();
  const needRef = period === "wtd" || period === "mtd" || period === "ytd";
  const startEpoch = needRef ? periodStartEpoch(period) : null;
  const fromEpoch = needRef ? startEpoch - 14 * DAY : null; // 2-week buffer covers holidays
  const toEpoch = Math.floor(Date.now() / 1000);

  const out = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`
        );
        const d = await r.json();
        if (d && typeof d.c === "number" && d.c > 0) {
          const entry = { c: d.c, pc: d.pc, o: d.o, h: d.h, l: d.l };
          if (needRef) {
            const ref = await refPrice(sym, fromEpoch, toEpoch, startEpoch, key);
            if (ref != null) entry.ref = ref;
          }
          out[sym] = entry;
        }
      } catch (e) {
      }
    })
  );

  // Period baselines are stable, so cache them longer than the live day quote.
  res.setHeader(
    "Cache-Control",
    needRef ? "s-maxage=300, stale-while-revalidate=600" : "s-maxage=10, stale-while-revalidate=20"
  );
  res.status(200).json(out);
}
