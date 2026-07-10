/**
 * /api/kalshi-history
 * ===================
 * Server-side fetch for historical Kalshi candlestick data. Separate from
 * /api/kalshi-markets because history and current-snapshot have very
 * different cache characteristics:
 *   - Current markets: change minute-by-minute → 5-min cache
 *   - History: past data never changes; only the leading edge grows.
 *     Safe to cache for 1 hour.
 *
 * Scope for this shipment: House only. Two markets — CONTROLH-2026-D
 * and CONTROLH-2026-R (Democratic and Republican YES contracts). We
 * return one time series per market: [{t: unix_seconds, p: probability}].
 *
 * The chart on prediction-markets.html renders these as two lines
 * (Democrat blue, Republican red) over time.
 *
 * Endpoint parameters:
 *   ?chamber=house  (default: house; senate reserved for future round)
 *
 * Response shape:
 *   { generated_at, chamber: "house", start_ts, end_ts,
 *     series: {
 *       dem: [{t, p}, ...],
 *       rep: [{t, p}, ...]
 *     } }
 */

import type { Config } from "@netlify/functions";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const CACHE_SECONDS = 3600; // 1 hour

/**
 * Which markets to pull history for, by chamber. Only House this round.
 * The series ticker is the parent (CONTROLH), the market tickers are the
 * per-party leaves.
 */
const CHAMBERS = {
  house: {
    series: "CONTROLH",
    dem: "CONTROLH-2026-D",
    rep: "CONTROLH-2026-R",
  },
  // senate reserved for a future round after House proves out
  senate: {
    series: "CONTROLS",
    dem: "CONTROLS-2026-D",
    rep: "CONTROLS-2026-R",
  },
};

type Candlestick = {
  end_period_ts: number;
  price?: {
    close_dollars?: string;
    mean_dollars?: string;
  };
  yes_bid?: { close_dollars?: string };
};

/**
 * Fetch daily candlesticks for one market between start and end.
 * Returns [{t, p}] where t is unix seconds and p is probability [0..1].
 * Prefers price.close_dollars (last traded price in period); falls back
 * to yes_bid close (best available if no trades that day).
 */
async function fetchDailyHistory(
  seriesTicker: string,
  marketTicker: string,
  startTs: number,
  endTs: number,
): Promise<{ t: number; p: number }[]> {
  const url =
    `${KALSHI}/series/${seriesTicker}/markets/${marketTicker}/candlesticks` +
    `?start_ts=${startTs}&end_ts=${endTs}&period_interval=1440`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "gerry-revealed/1.0" },
  });
  if (!resp.ok) {
    throw new Error(`Kalshi ${marketTicker} → ${resp.status}`);
  }
  const data = await resp.json();
  const candles: Candlestick[] = Array.isArray(data.candlesticks)
    ? data.candlesticks
    : [];
  const points: { t: number; p: number }[] = [];
  for (const c of candles) {
    // Prefer last-trade close price; fall back to bid close if no trades.
    let priceStr: string | undefined =
      c.price?.close_dollars ??
      c.price?.mean_dollars ??
      c.yes_bid?.close_dollars;
    if (!priceStr) continue;
    const p = parseFloat(priceStr);
    if (Number.isNaN(p) || p <= 0 || p > 1) continue;
    points.push({ t: c.end_period_ts, p });
  }
  return points;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const chamberParam = (url.searchParams.get("chamber") || "house").toLowerCase();
  const chamber =
    chamberParam === "senate" ? "senate" : "house"; // default/fallback = house
  const tickers = CHAMBERS[chamber];

  // Time range: from Sept 1, 2024 (before House control markets started
  // trading) to now. Kalshi will simply return whatever data it has.
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = Math.floor(new Date("2024-09-01T00:00:00Z").getTime() / 1000);

  let demPoints: { t: number; p: number }[] = [];
  let repPoints: { t: number; p: number }[] = [];
  const errors: string[] = [];

  try {
    demPoints = await fetchDailyHistory(
      tickers.series,
      tickers.dem,
      startTs,
      endTs,
    );
  } catch (e) {
    errors.push(`dem: ${(e as Error).message}`);
  }
  try {
    repPoints = await fetchDailyHistory(
      tickers.series,
      tickers.rep,
      startTs,
      endTs,
    );
  } catch (e) {
    errors.push(`rep: ${(e as Error).message}`);
  }

  const body = {
    generated_at: new Date().toISOString(),
    cache_max_age_s: CACHE_SECONDS,
    chamber,
    start_ts: startTs,
    end_ts: endTs,
    series: {
      dem: demPoints,
      rep: repPoints,
    },
    // Include errors (if any) rather than failing the whole request; the
    // page can still render whichever side succeeded.
    errors: errors.length ? errors : undefined,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      "Netlify-CDN-Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
    },
  });
};

export const config: Config = {
  path: "/api/kalshi-history",
};
