/**
 * /api/kalshi-markets
 * ===================
 * Server-side proxy for Kalshi's public read API. Fetches the current
 * probabilities for three "control" markets — House, Senate, and the
 * Congress balance-of-power combo — and returns a normalized summary.
 *
 * WHY THIS EXISTS AS A FUNCTION (vs. calling Kalshi from the browser):
 *   1. CORS — Kalshi's public docs don't guarantee browser access. Even if
 *      it works today, they can change it. Server-side is stable.
 *   2. Caching — we cache for 5 minutes so 100 visitors don't hammer Kalshi
 *      100 times. Netlify's edge cache handles this via response headers.
 *   3. Shape — Kalshi's response is verbose. We flatten it to just what
 *      the page needs, so the client-side code stays small.
 *
 * ENDPOINT SHAPE:
 *   GET /api/kalshi-markets
 *   → { generated_at: ISO_string,
 *       cache_max_age_s: 300,
 *       house: { dem_pct, rep_pct, volume, kalshi_url },
 *       senate: { dem_pct, rep_pct, volume, kalshi_url },
 *       balance: { outcomes: [{ label, pct }, ...], kalshi_url } }
 *
 * If Kalshi is unreachable or a market is closed, the corresponding field
 * is null and we still return the others — never fail the whole response
 * because one market broke.
 */

import type { Config } from "@netlify/functions";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const CACHE_SECONDS = 300; // 5 minutes

// Series tickers for the three control markets. Discovered from Kalshi's URLs:
//   kalshi.com/markets/controlh          → House control
//   kalshi.com/markets/controls          → Senate control
//   kalshi.com/markets/kxbalancepowercombo → Combo
const SERIES = {
  house: "CONTROLH",
  senate: "CONTROLS",
  balance: "KXBALANCEPOWERCOMBO",
};

interface KalshiMarket {
  ticker: string;
  yes_sub_title?: string;
  yes_bid_dollars?: string; // "0.7800" style
  yes_ask_dollars?: string;
  last_price?: number; // cents 0-100 fallback
  volume?: number;
}

interface KalshiEvent {
  event_ticker: string;
  title?: string;
  markets?: KalshiMarket[];
}

async function fetchEvents(seriesTicker: string): Promise<KalshiEvent[]> {
  const url =
    `${KALSHI}/events?series_ticker=${seriesTicker}&status=open&with_nested_markets=true&limit=50`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "gerry-revealed/1.0" },
  });
  if (!resp.ok) throw new Error(`Kalshi ${seriesTicker} → ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.events) ? data.events : [];
}

/**
 * Extract the current YES probability from a market, in [0, 1].
 * Kalshi may report as yes_bid_dollars ("0.7800") or last_price (78, cents).
 * Prefer bid → ask midpoint if both present; else last trade; else null.
 */
function marketProbability(m: KalshiMarket): number | null {
  const bid = m.yes_bid_dollars ? parseFloat(m.yes_bid_dollars) : NaN;
  const ask = m.yes_ask_dollars ? parseFloat(m.yes_ask_dollars) : NaN;
  if (!Number.isNaN(bid) && !Number.isNaN(ask) && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }
  if (!Number.isNaN(bid) && bid > 0) return bid;
  if (typeof m.last_price === "number" && m.last_price > 0) {
    return m.last_price / 100;
  }
  return null;
}

/**
 * Find the current market for a party inside an event. Kalshi encodes party
 * either in yes_sub_title ("Democrat", "Republican") or as a suffix on the
 * market ticker ("-D", "-R"). Try both, tolerate case.
 */
function findPartyMarket(
  event: KalshiEvent | undefined,
  party: "D" | "R",
): KalshiMarket | null {
  if (!event?.markets) return null;
  const partyWord = party === "D" ? "democrat" : "republican";
  for (const m of event.markets) {
    const sub = (m.yes_sub_title || "").toLowerCase();
    if (sub.includes(partyWord)) return m;
    if (m.ticker && m.ticker.toUpperCase().endsWith(`-${party}`)) return m;
  }
  return null;
}

function sumVolume(event: KalshiEvent | undefined): number {
  if (!event?.markets) return 0;
  return event.markets.reduce((sum, m) => sum + (m.volume || 0), 0);
}

async function partyControlSummary(
  seriesTicker: string,
  kalshiCategoryUrl: string,
): Promise<{ dem_pct: number | null; rep_pct: number | null; volume: number; kalshi_url: string } | null> {
  try {
    const events = await fetchEvents(seriesTicker);
    if (events.length === 0) return null;
    // Prefer the current-cycle event. The API returns them sorted by close date
    // (soonest first); the first open one is what we want.
    const event = events[0];
    const dem = findPartyMarket(event, "D");
    const rep = findPartyMarket(event, "R");
    return {
      dem_pct: dem ? marketProbability(dem) : null,
      rep_pct: rep ? marketProbability(rep) : null,
      volume: sumVolume(event),
      kalshi_url: kalshiCategoryUrl,
    };
  } catch (err) {
    // Never fail the whole response for one market; return null instead.
    console.error(`kalshi ${seriesTicker} fetch failed:`, err);
    return null;
  }
}

async function balanceOfPowerSummary(): Promise<
  { outcomes: { label: string; pct: number | null }[]; kalshi_url: string } | null
> {
  try {
    const events = await fetchEvents(SERIES.balance);
    if (events.length === 0) return null;
    const event = events[0];
    if (!event.markets) return null;
    // Balance combo has 4 outcomes: D-D, D-R, R-D, R-R (House-Senate).
    // Return each with its label and current probability.
    const outcomes = event.markets
      .map((m) => ({
        label: m.yes_sub_title || m.ticker,
        pct: marketProbability(m),
      }))
      // Prefer the highest-probability outcome first for display
      .sort((a, b) => (b.pct || 0) - (a.pct || 0));
    return {
      outcomes,
      kalshi_url: "https://kalshi.com/markets/kxbalancepowercombo",
    };
  } catch (err) {
    console.error("kalshi balance-of-power fetch failed:", err);
    return null;
  }
}

export default async () => {
  const [house, senate, balance] = await Promise.all([
    partyControlSummary(SERIES.house, "https://kalshi.com/markets/controlh"),
    partyControlSummary(SERIES.senate, "https://kalshi.com/markets/controls"),
    balanceOfPowerSummary(),
  ]);

  const body = {
    generated_at: new Date().toISOString(),
    cache_max_age_s: CACHE_SECONDS,
    source: "Kalshi Trade API (public)",
    house,
    senate,
    balance,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Tell Netlify's edge to cache the response for CACHE_SECONDS.
      // stale-while-revalidate lets the CDN serve a slightly-stale copy
      // while re-fetching in the background, so response times stay fast.
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
      "Netlify-CDN-Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
    },
  });
};

export const config: Config = {
  path: "/api/kalshi-markets",
};
