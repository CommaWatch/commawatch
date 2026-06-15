// CommaWatch — price fetcher (Vercel serverless function)
// Lives at /api/quotes. The page calls it like:  /api/quotes?symbols=TSLA,ORCL,AMZN
// It asks Finnhub for each ticker's price and returns them as JSON.
// Your secret API key stays here on the server and is never shown to visitors.

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

  const out = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`
        );
        const d = await r.json();
        if (d && typeof d.c === "number" && d.c > 0) {
          out[sym] = { c: d.c, pc: d.pc, o: d.o, h: d.h, l: d.l };
        }
      } catch (e) {
      }
    })
  );

  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
  res.status(200).json(out);
}
