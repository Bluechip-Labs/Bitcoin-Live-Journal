// /api/price.js
// Cached CoinGecko proxy — one fetch per 15 seconds shared across all visitors.
// The module-level cache persists across requests within the same serverless instance.

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 15_000; // 15 seconds

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");

  const now = Date.now();

  // Serve from cache if fresh
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json({
      ...cache.data,
      _cached: true,
      _age: Math.round((now - cache.timestamp) / 1000),
      _nextRefresh: Math.round((CACHE_TTL - (now - cache.timestamp)) / 1000),
    });
  }

  // Fetch fresh data from CoinGecko
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?" +
        "ids=bitcoin,ethereum" +
        "&vs_currencies=usd" +
        "&include_24hr_change=true" +
        "&include_market_cap=true" +
        "&include_24hr_vol=true" +
        "&include_high_24hr=true" +
        "&include_low_24hr=true",
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const json = await response.json();

    const priceData = {
      bitcoin: {
        price: json.bitcoin?.usd ?? null,
        change24h: json.bitcoin?.usd_24h_change ?? null,
        marketCap: json.bitcoin?.usd_market_cap ?? null,
        high24h: json.bitcoin?.usd_24h_high ?? null,
        low24h: json.bitcoin?.usd_24h_low ?? null,
        volume24h: json.bitcoin?.usd_24h_vol ?? null,
      },
      ethereum: {
        price: json.ethereum?.usd ?? null,
        change24h: json.ethereum?.usd_24h_change ?? null,
      },
      timestamp: new Date().toISOString(),
    };

    // Update cache
    cache = { data: priceData, timestamp: now };

    return res.status(200).json({
      ...priceData,
      _cached: false,
      _age: 0,
      _nextRefresh: Math.round(CACHE_TTL / 1000),
    });
  } catch (error) {
    // If fetch fails but we have stale cache, serve it
    if (cache.data) {
      return res.status(200).json({
        ...cache.data,
        _cached: true,
        _stale: true,
        _age: Math.round((now - cache.timestamp) / 1000),
        _error: error.message,
      });
    }

    return res.status(502).json({
      error: "Unable to fetch price data",
      message: error.message,
    });
  }
}
