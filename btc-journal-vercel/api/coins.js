// /api/coins.js
// Top 20 coins by market cap (excluding stablecoins), cached for 60 seconds.

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60_000; // 60 seconds — rankings don't change fast

const STABLECOINS = new Set([
  "tether", "usd-coin", "dai", "first-digital-usd", "ethena-usde",
  "usds", "usdd", "frax", "true-usd", "paxos-standard",
  "paypal-usd", "gemini-dollar", "binance-usd",
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

  const now = Date.now();

  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json({ coins: cache.data, _cached: true });
  }

  try {
    // Fetch 30 to have room after filtering stablecoins
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?" +
        "vs_currency=usd&order=market_cap_desc&per_page=30&page=1" +
        "&sparkline=false&price_change_percentage=1h,24h,7d",
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

    const raw = await response.json();

    // Filter stablecoins, take top 20
    const coins = raw
      .filter((c) => !STABLECOINS.has(c.id))
      .slice(0, 20)
      .map((c, i) => ({
        rank: i + 1,
        id: c.id,
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change1h: c.price_change_percentage_1h_in_currency,
        change24h: c.price_change_percentage_24h,
        change7d: c.price_change_percentage_7d_in_currency,
        marketCap: c.market_cap,
        image: c.image,
      }));

    cache = { data: coins, timestamp: now };

    return res.status(200).json({ coins, _cached: false });
  } catch (error) {
    if (cache.data) {
      return res.status(200).json({ coins: cache.data, _cached: true, _stale: true });
    }
    return res.status(502).json({ error: "Unable to fetch coin data", message: error.message });
  }
}
