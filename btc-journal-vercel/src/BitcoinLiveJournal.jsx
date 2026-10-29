import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from "recharts";

// ─── Static Data ────────────────────────────────────────────────────────────

const HALVINGS = [
  { date: "2012-11-28", block: 210000, reward: "25 BTC", label: "1st Halving" },
  { date: "2016-07-09", block: 420000, reward: "12.5 BTC", label: "2nd Halving" },
  { date: "2020-05-11", block: 630000, reward: "6.25 BTC", label: "3rd Halving" },
  { date: "2024-04-19", block: 840000, reward: "3.125 BTC", label: "4th Halving" },
  { date: "2028-03-15", block: 1050000, reward: "1.5625 BTC", label: "5th Halving (est.)" },
];

const CYCLE_PEAKS = [
  { cycle: 1, halving: "Nov 2012", peak: "Nov 2013", peakPrice: 1163, monthsToTop: 12, drawdown: 86, bearMonths: 14, troughPrice: 163 },
  { cycle: 2, halving: "Jul 2016", peak: "Dec 2017", peakPrice: 19783, monthsToTop: 17, drawdown: 84, bearMonths: 12, troughPrice: 3122 },
  { cycle: 3, halving: "May 2020", peak: "Nov 2021", peakPrice: 67617, monthsToTop: 18, drawdown: 77, bearMonths: 12, troughPrice: 15476 },
  { cycle: 4, halving: "Apr 2024", peak: "Oct 2025", peakPrice: 126000, monthsToTop: 18, drawdown: 52, bearMonths: null, troughPrice: null },
];

const BEAR_DRAWDOWNS = [
  { year: "2011", drawdown: 93, months: 5, color: "#8B0000" },
  { year: "2013–15", drawdown: 86, months: 14, color: "#A52A2A" },
  { year: "2017–18", drawdown: 84, months: 12, color: "#CD3333" },
  { year: "2021–22", drawdown: 77, months: 12, color: "#E04040" },
  { year: "2025–26", drawdown: 52, months: null, color: "#F7931A" },
];

const SEASONALITY = [
  { month: "Jan", avg: 4.2 }, { month: "Feb", avg: 9.8 }, { month: "Mar", avg: 11.5 },
  { month: "Apr", avg: 11.0 }, { month: "May", avg: 10.0 }, { month: "Jun", avg: 1.5 },
  { month: "Jul", avg: 10.0 }, { month: "Aug", avg: -1.0 }, { month: "Sep", avg: -4.5 },
  { month: "Oct", avg: 14.5 }, { month: "Nov", avg: 36.5 }, { month: "Dec", avg: 6.0 },
];

const WMA_BOUNCES = [
  { year: "2015", context: "Post Mt. Gox", returnPct: 290 },
  { year: "Late 2018", context: "Post ICO Bubble", returnPct: 160 },
  { year: "Mar 2020", context: "COVID Crash", returnPct: 170 },
  { year: "2022–23", context: "Terra/FTX", returnPct: 330 },
];

const BANK_ADOPTION = [
  { bank: "Fidelity", score: 71 }, { bank: "BNY", score: 46 }, { bank: "Goldman Sachs", score: 45 },
  { bank: "Citigroup", score: 43 }, { bank: "JPMorgan", score: 43 }, { bank: "Morgan Stanley", score: 43 },
  { bank: "Banco Santander", score: 35 }, { bank: "Soc. Générale", score: 35 },
  { bank: "SMBC", score: 13 }, { bank: "RBC", score: 13 },
];

const SCENARIO_DATA = [
  { label: "Bull Case", price: 150000, desc: "ETF-driven new ATH", prob: 15, color: "#22c55e" },
  { label: "Moderate Bull", price: 100000, desc: "Institutional floor holds", prob: 20, color: "#86efac" },
  { label: "Base Case", price: 75000, desc: "Cycle correction, gradual recovery", prob: 35, color: "#F7931A" },
  { label: "Bear Case", price: 55000, desc: "Extended bear, macro stress", prob: 20, color: "#ef4444" },
  { label: "Deep Bear", price: 38000, desc: "Black swan / 2022-style washout", prob: 10, color: "#7f1d1d" },
];

const generateCycleOverlay = () => {
  const months = [];
  for (let m = 0; m <= 36; m++) {
    const c2 = 100 * Math.pow(1.08, m) * (m < 17 ? 1 : Math.max(0.3, 1 - (m - 17) * 0.06));
    const c3 = 100 * Math.pow(1.07, m) * (m < 18 ? 1 : Math.max(0.35, 1 - (m - 18) * 0.055));
    const c4 = m <= 26 ? 100 * Math.pow(1.065, m) * (m < 18 ? 1 : Math.max(0.4, 1 - (m - 18) * 0.05)) : null;
    months.push({ month: m, label: `M+${m}`, "Cycle 2 (2016)": Math.round(c2), "Cycle 3 (2020)": Math.round(c3), "Cycle 4 (2024)": m <= 26 ? Math.round(c4) : null });
  }
  return months;
};

// ─── Shared Components ──────────────────────────────────────────────────────

const TabButton = ({ active, onClick, children, icon }) => (
  <button onClick={onClick} style={{
    padding: "10px 14px", background: active ? "#F7931A" : "rgba(255,255,255,0.04)",
    color: active ? "#0a0a0a" : "#aaa", border: active ? "1px solid #F7931A" : "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
    fontWeight: active ? 700 : 500, letterSpacing: "0.03em", transition: "all 0.2s",
    display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
  }}><span style={{ fontSize: 13 }}>{icon}</span>{children}</button>
);

const Card = ({ children, style, glow }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)", border: glow ? "1px solid rgba(247,147,26,0.3)" : "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8, padding: 20, boxShadow: glow ? "0 0 30px rgba(247,147,26,0.08)" : "none", ...style,
  }}>{children}</div>
);

const StatBox = ({ label, value, sub, color, small }) => (
  <div style={{
    textAlign: "center", padding: small ? "10px 8px" : "14px 12px",
    background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)",
    flex: 1, minWidth: small ? 75 : 100,
  }}>
    <div style={{ fontSize: small ? 9 : 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color || "#F7931A", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e5e5e5", letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</h3>
    {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666", lineHeight: 1.5 }}>{sub}</p>}
  </div>
);

const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#F7931A", textDecoration: "none", borderBottom: "1px dotted rgba(247,147,26,0.4)", fontSize: "inherit" }}>{children}</a>
);





const ChartLink = ({ href, title, desc, tag }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
    background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)",
    textDecoration: "none", transition: "border-color 0.2s",
  }}>
    <span style={{ fontSize: 18, flexShrink: 0 }}>📊</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>{title}</div>
      <div style={{ fontSize: 10, color: "#666", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
    </div>
    {tag && <span style={{ fontSize: 9, color: "#F7931A", fontWeight: 700, padding: "2px 6px", background: "rgba(247,147,26,0.1)", borderRadius: 3, flexShrink: 0 }}>{tag}</span>}
    <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>↗</span>
  </a>
);

// ─── BC25 Defender Index Promo ──────────────────────────────────────────────
// Email signups go to Formspree. Replace FORMSPREE_ID with your form's ID
// from https://formspree.io (e.g. "xpzgkqab" → the part after /f/).
const FORMSPREE_ID = "YOUR_FORMSPREE_ID";
const BC25_URL = "https://bc25-4907cf.webflow.io/";

const BC25Promo = () => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setState("error"); setMsg("Please enter a valid email address.");
      return;
    }
    if (FORMSPREE_ID === "YOUR_FORMSPREE_ID") {
      setState("error"); setMsg("Signup isn't connected yet — set your Formspree ID.");
      return;
    }
    setState("sending"); setMsg("");
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmed, source: "Bitcoin Live Journal", interest: "BC25 Defender Index" }),
      });
      if (res.ok) { setState("done"); setMsg("You're on the list — thanks for your interest in BC25."); setEmail(""); }
      else { const d = await res.json().catch(() => ({})); throw new Error(d?.errors?.[0]?.message || "Submission failed"); }
    } catch (err) {
      setState("error"); setMsg(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 10,
      border: "1px solid rgba(247,147,26,0.35)",
      background: "linear-gradient(135deg, rgba(247,147,26,0.10) 0%, rgba(10,10,10,0.2) 55%, rgba(34,197,94,0.06) 100%)",
      boxShadow: "0 0 40px rgba(247,147,26,0.10)", padding: 20,
    }}>
      {/* corner glow accent */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(247,147,26,0.18), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#0a0a0a", background: "#F7931A", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>From Bluechip Labs</span>
        <span style={{ fontSize: 10, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>Building in public</span>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
            BC25 <span style={{ color: "#F7931A" }}>Defender Index</span>
          </h3>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.6, color: "#bbb" }}>
            A rules-based, treasury-first <strong style={{ color: "#ddd" }}>defensive crypto index token</strong> on Base — tracking the top ~25 assets by market cap with daily rebalancing and built-in staking rewards. Designed to weather cycles like the ones this journal tracks.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
            {["Top ~25 by market cap", "Daily rebalancing", "Real-yield staking", "Built on Base"].map((f, i) => (
              <span key={i} style={{ fontSize: 11, color: "#999", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span>{f}
              </span>
            ))}
          </div>
        </div>

        {/* Signup — primary CTA */}
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#eee", marginBottom: 8 }}>
            Get BC25 progress updates
          </div>
          {state === "done" ? (
            <div style={{ padding: "12px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, fontSize: 12, color: "#22c55e", lineHeight: 1.5 }}>
              ✓ {msg}
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="you@email.com" aria-label="Email address"
                style={{
                  flex: "1 1 160px", minWidth: 0, padding: "10px 12px", fontSize: 13,
                  background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 6, color: "#fff", outline: "none", fontFamily: "inherit",
                }}
              />
              <button type="submit" disabled={state === "sending"} style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: "#F7931A", color: "#0a0a0a", border: "none", borderRadius: 6,
                cursor: state === "sending" ? "default" : "pointer", opacity: state === "sending" ? 0.7 : 1,
              }}>
                {state === "sending" ? "Joining…" : "Keep me posted"}
              </button>
            </form>
          )}
          {state === "error" && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#ef4444" }}>{msg}</div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: "#777" }}>
            Prefer to explore first?{" "}
            <a href={BC25_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#F7931A", textDecoration: "none", borderBottom: "1px dotted rgba(247,147,26,0.5)" }}>
              Visit the BC25 site ↗
            </a>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9, color: "#555", lineHeight: 1.5 }}>
        BC25 is a Bluechip Labs project in pre-launch development. Not an offer to sell or solicitation to buy any token. Not financial advice.
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ color: "#888", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#F7931A" }}>
          {p.name}: {typeof p.value === "number" ? (p.value > 1000 ? `$${p.value.toLocaleString()}` : `${p.value}%`) : p.value}
        </div>
      ))}
    </div>
  );
};

const LevelRow = ({ level, type, note, color }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
    background: "rgba(0,0,0,0.2)", borderRadius: 4, borderLeft: `3px solid ${color}`, flexWrap: "wrap",
  }}>
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#ddd", minWidth: 110 }}>{level}</span>
    <span style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase", minWidth: 70 }}>{type}</span>
    <span style={{ fontSize: 11, color: "#666", flex: 1, minWidth: 140 }}>{note}</span>
  </div>
);

// ─── Live Price Hook ────────────────────────────────────────────────────────

function useLivePrice(intervalMs) {
  const [data, setData] = useState({
    btcPrice: null, btcChange24h: null, btcMarketCap: null, btcHigh24h: null, btcLow24h: null,
    ethPrice: null, ethChange24h: null,
    lastUpdate: null, status: "loading", errorCount: 0, source: null,
  });
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const useProxy = useRef(null); // null = unknown, true = proxy works, false = direct

  const fetchPrice = useCallback(async () => {
    try {
      let btcPrice, btcChange24h, btcMarketCap, btcHigh24h, btcLow24h, ethPrice, ethChange24h, source;

      // Try proxy first (only if not already known to fail)
      if (useProxy.current !== false) {
        try {
          const res = await fetch("/api/price", { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const json = await res.json();
            btcPrice = json.bitcoin?.price; btcChange24h = json.bitcoin?.change24h;
            btcMarketCap = json.bitcoin?.marketCap; btcHigh24h = json.bitcoin?.high24h;
            btcLow24h = json.bitcoin?.low24h; ethPrice = json.ethereum?.price;
            ethChange24h = json.ethereum?.change24h;
            source = json._cached ? "proxy (cached)" : "proxy (fresh)";
            useProxy.current = true;
          } else { throw new Error("proxy unavailable"); }
        } catch {
          useProxy.current = false; // proxy not available, use direct
        }
      }

      // Fallback: direct CoinGecko call (local dev or proxy failure)
      if (!btcPrice) {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        btcPrice = json.bitcoin?.usd; btcChange24h = json.bitcoin?.usd_24h_change;
        btcMarketCap = json.bitcoin?.usd_market_cap; btcHigh24h = json.bitcoin?.usd_24h_high;
        btcLow24h = json.bitcoin?.usd_24h_low; ethPrice = json.ethereum?.usd;
        ethChange24h = json.ethereum?.usd_24h_change;
        source = "direct";
      }

      setData({
        btcPrice, btcChange24h, btcMarketCap, btcHigh24h, btcLow24h,
        ethPrice, ethChange24h, lastUpdate: new Date(), status: "live", errorCount: 0, source,
      });
      setCountdown(Math.round(intervalMs / 1000));
    } catch (e) {
      setData(prev => ({ ...prev, status: prev.btcPrice ? "stale" : "error", errorCount: prev.errorCount + 1 }));
    }
  }, [intervalMs]);

  useEffect(() => {
    fetchPrice();
    if (intervalMs > 0) {
      intervalRef.current = setInterval(fetchPrice, intervalMs);
      countdownRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    }
    return () => { clearInterval(intervalRef.current); clearInterval(countdownRef.current); };
  }, [fetchPrice, intervalMs]);

  return { ...data, countdown, refetch: fetchPrice };
}



// ─── Top Coins Hook ─────────────────────────────────────────────────────────

function useTopCoins() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCoins = useCallback(async () => {
    try {
      // Try proxy first
      let data;
      try {
        const res = await fetch("/api/coins", { signal: AbortSignal.timeout(5000) });
        if (res.ok) { data = await res.json(); }
      } catch {}

      // Fallback: direct CoinGecko
      if (!data) {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=1h,24h,7d",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error("fetch failed");
        const raw = await res.json();
        data = { coins: raw.slice(0, 20).map((c, i) => ({
          rank: i + 1, id: c.id, symbol: c.symbol?.toUpperCase(), name: c.name,
          price: c.current_price, change24h: c.price_change_percentage_24h,
          change7d: c.price_change_percentage_7d_in_currency, marketCap: c.market_cap, image: c.image,
        })) };
      }
      setCoins(data.coins || []);
    } catch { /* keep existing data */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCoins();
    const interval = setInterval(fetchCoins, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchCoins]);

  return { coins, loading };
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function BitcoinLiveJournal() {
  const [tab, setTab] = useState("dashboard");
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30s default
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRemaining, setAiRemaining] = useState(null);
  const [aiMode, setAiMode] = useState("auto");
  const [aiProvider, setAiProvider] = useState(() => {
    try { return localStorage.getItem("btcjournal_provider") || "gemini"; } catch { return "gemini"; }
  });
  const [apiKey, setApiKey] = useState(() => {
    try {
      const provider = localStorage.getItem("btcjournal_provider") || "gemini";
      return localStorage.getItem(`btcjournal_apikey_${provider}`) || "";
    } catch { return ""; }
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [prevPrice, setPrevPrice] = useState(null);
  const [priceFlash, setPriceFlash] = useState(null); // "up" | "down" | null

  const live = useLivePrice(refreshInterval);
  const topCoins = useTopCoins();

  const currentPrice = live.btcPrice || 64779;
  const priceChange = live.btcChange24h != null ? live.btcChange24h : 0;
  const ATH = 126000;
  const drawdownFromATH = (((currentPrice - ATH) / ATH) * 100).toFixed(1);
  const daysSinceHalving = Math.floor((new Date() - new Date("2024-04-19")) / 86400000);
  const daysSincePeak = Math.floor((new Date() - new Date("2025-10-07")) / 86400000);
  const monthsSinceHalving = (daysSinceHalving / 30.44).toFixed(1);
  const monthsSincePeak = (daysSincePeak / 30.44).toFixed(1);
  const daysToHalving = Math.floor((new Date("2028-03-15") - new Date()) / 86400000);

  // Flash effect on price change
  useEffect(() => {
    if (live.btcPrice && prevPrice && live.btcPrice !== prevPrice) {
      setPriceFlash(live.btcPrice > prevPrice ? "up" : "down");
      const t = setTimeout(() => setPriceFlash(null), 1200);
      return () => clearTimeout(t);
    }
    if (live.btcPrice) setPrevPrice(live.btcPrice);
  }, [live.btcPrice]);

  const switchProvider = (provider) => {
    setAiProvider(provider);
    try {
      localStorage.setItem("btcjournal_provider", provider);
      const savedKey = localStorage.getItem(`btcjournal_apikey_${provider}`) || "";
      setApiKey(savedKey);
    } catch {}
    setAiError("");
    setAiAnalysis("");
  };

  const saveApiKey = (key) => {
    setApiKey(key);
    try { localStorage.setItem(`btcjournal_apikey_${aiProvider}`, key); } catch {}
  };

  const aiPrompt = `You are a Bitcoin cycle analyst writing a journal entry for ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. BTC is at $${currentPrice.toLocaleString()}, down ${Math.abs(drawdownFromATH)}% from ATH $126K (Oct 2025). We are ${monthsSinceHalving} months post-halving, ${monthsSincePeak} months post-peak. Key technicals: price below 50-day EMA ($65,143) and 200-day EMA ($74,705). RSI at 48.9. Put/call ratio 0.56. Short-term support $61,300/$60,000, pivot at $65,160, upside targets $72,200/$74,700. 200-WMA being tested for 5th time in history — prior touches led to 160-330% returns. Strategy's new Bank Adoption Index shows 32% average. LTH capitulation peaked at $280M/day. Write 3 paragraphs: (1) cycle position vs history, (2) technical picture and key levels, (3) scenarios and what to watch. IMPORTANT: Write in plain text only. Do not use markdown, asterisks, bullet points, bold, headers, or any formatting. Just plain sentences and paragraphs. End with a one-line disclaimer.`;

  const fetchAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    try {
      let responseText = "";
      let usedProxy = false;

      // Try server proxy first (deployed on Vercel — no API key needed from user)
      if (aiMode !== "direct") {
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: aiPrompt }),
            signal: AbortSignal.timeout(35000),
          });
          const json = await res.json();
          if (res.ok) {
            responseText = json.analysis;
            setAiRemaining(json.remaining);
            usedProxy = true;
            setAiMode("proxy");
          } else if (res.status === 429) {
            throw new Error(json.message || "Rate limit reached.");
          } else {
            throw new Error(json.message || "Proxy error");
          }
        } catch (proxyErr) {
          if (proxyErr.message?.includes("Rate limit") || proxyErr.message?.includes("rate limit")) throw proxyErr;
          if (aiMode === "proxy") throw proxyErr;
          // Proxy unavailable — fall through to direct
        }
      }

      // Fallback: direct API call (local dev or proxy unavailable)
      if (!usedProxy && !responseText) {
        if (!apiKey.trim()) {
          setShowKeyInput(true);
          setAiError("Proxy unavailable (local dev). Enter an API key below for direct access.");
          setAiLoading(false);
          setAiMode("direct");
          return;
        }
        if (aiProvider === "gemini") {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`,
            { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }) }
          );
          if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini returned ${response.status}`); }
          const data = await response.json();
          responseText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") || "Analysis unavailable.";
        } else {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim(),
              "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: aiPrompt }] }),
          });
          if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e?.error?.message || `Claude returned ${response.status}`); }
          const data = await response.json();
          responseText = data.content?.map(i => i.text || "").join("\n") || "Analysis unavailable.";
        }
        setAiMode("direct");
      }
      setAiAnalysis(responseText);
    } catch (e) {
      setAiError(e.message || "Unable to generate analysis.");
      if (e.message?.includes("401") || e.message?.includes("invalid") || e.message?.includes("API_KEY")) setShowKeyInput(true);
    }
    setAiLoading(false);
  }, [apiKey, aiProvider, aiPrompt, aiMode]);

  const cycleOverlay = generateCycleOverlay();

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "technicals", label: "Technicals", icon: "⊞" },
    { id: "scenarios", label: "Scenarios", icon: "⟁" },
    { id: "cycles", label: "Cycles", icon: "↻" },
    { id: "seasonality", label: "Seasonal", icon: "◐" },
    { id: "onchain", label: "On-Chain", icon: "⛓" },
    { id: "journal", label: "AI Journal", icon: "✎" },
  ];

  const statusColor = live.status === "live" ? "#22c55e" : live.status === "stale" ? "#F7931A" : live.status === "error" ? "#ef4444" : "#555";
  const statusLabel = live.status === "live" ? "LIVE" : live.status === "stale" ? "STALE" : live.status === "loading" ? "CONNECTING..." : "OFFLINE";

  const currentDrawdownPct = live.btcPrice ? Math.abs(((live.btcPrice - ATH) / ATH) * 100).toFixed(1) : Math.abs(drawdownFromATH);
  // Update bear drawdown dynamically
  const dynamicBearDrawdowns = BEAR_DRAWDOWNS.map((b, i) =>
    i === 4 ? { ...b, drawdown: Math.round(currentDrawdownPct) } : b
  );

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#0a0a0a", color: "#d4d4d4", minHeight: "100vh", maxWidth: 1180, margin: "0 auto", padding: "0 16px 40px" }}>

      {/* ═══ HEADER ═══ */}
      <header style={{ padding: "24px 0 14px", borderBottom: "1px solid rgba(247,147,26,0.15)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F7931A", letterSpacing: "-0.02em" }}>₿ LIVE JOURNAL</h1>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>BITCOIN CYCLE ANALYSIS</span>
        </div>

        {/* ── Price Display with Flash ── */}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
            color: priceFlash === "up" ? "#22c55e" : priceFlash === "down" ? "#ef4444" : "#fff",
            transition: "color 0.3s ease",
            textShadow: priceFlash ? `0 0 12px ${priceFlash === "up" ? "#22c55e" : "#ef4444"}44` : "none",
          }}>
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{
            fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
            color: priceChange >= 0 ? "#22c55e" : "#ef4444",
            padding: "3px 8px",
            background: priceChange >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            borderRadius: 4,
          }}>
            {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
          </span>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>{drawdownFromATH}% from ATH</span>

        </div>

        {/* ── Live Status Bar ── */}
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: 6,
          border: `1px solid ${statusColor}22`,
        }}>
          {/* Status Dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: live.status === "live" ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              {statusLabel}
            </span>
          </div>

          {/* Countdown */}
          {live.status !== "loading" && refreshInterval > 0 && (
            <span style={{ fontSize: 10, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
              Next refresh: {live.countdown}s
            </span>
          )}

          {/* Countdown Bar */}
          {refreshInterval > 0 && (
            <div style={{ flex: 1, minWidth: 60, maxWidth: 120, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: statusColor,
                width: `${(live.countdown / (refreshInterval / 1000)) * 100}%`,
                transition: "width 1s linear",
                borderRadius: 2,
              }} />
            </div>
          )}

          {/* Last Updated */}
          {live.lastUpdate && (
            <span style={{ fontSize: 9, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
              Updated {live.lastUpdate.toLocaleTimeString()}
            </span>
          )}

          {/* Refresh Interval Selector */}
          <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
            {[
              { label: "15s", ms: 15000 },
              { label: "30s", ms: 30000 },
              { label: "60s", ms: 60000 },
              { label: "OFF", ms: 0 },
            ].map(opt => (
              <button key={opt.ms} onClick={() => setRefreshInterval(opt.ms)} style={{
                padding: "3px 8px", fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                background: refreshInterval === opt.ms ? statusColor + "22" : "transparent",
                color: refreshInterval === opt.ms ? statusColor : "#555",
                border: refreshInterval === opt.ms ? `1px solid ${statusColor}44` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 3, cursor: "pointer", fontWeight: refreshInterval === opt.ms ? 700 : 400,
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Manual Refresh */}
          <button onClick={live.refetch} title="Refresh now" style={{
            background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3,
            color: "#888", cursor: "pointer", padding: "2px 6px", fontSize: 12, lineHeight: 1,
          }}>⟳</button>
        </div>

        {/* ── Live Resources ── */}
        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          <ExtLink href="https://www.binance.com/en/price/bitcoin">Binance Live</ExtLink>
          <span style={{ color: "#333" }}>│</span>
          <ExtLink href="https://www.lookintobitcoin.com/charts/">LookIntoBitcoin Charts</ExtLink>
          <span style={{ color: "#333" }}>│</span>
          <ExtLink href="https://alternative.me/crypto/fear-and-greed-index/">Fear & Greed</ExtLink>
          <span style={{ color: "#333" }}>│</span>
          <ExtLink href="https://www.tradingview.com/symbols/BTCUSD/technicals/">TradingView</ExtLink>
        </div>
      </header>

      {/* ═══ NAV ═══ */}
      <nav style={{ display: "flex", gap: 5, padding: "12px 0", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {tabs.map(t => <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon}>{t.label}</TabButton>)}
      </nav>

      {/* ═══ CONTENT + SIDEBAR LAYOUT ═══ */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

      {/* ═══ MAIN CONTENT ═══ */}
      <main style={{ paddingTop: 18, flex: 1, minWidth: 0 }}>

        {/* ═══════════════ DASHBOARD ═══════════════ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <BC25Promo />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatBox label="Days Post-Halving" value={daysSinceHalving} sub={`${monthsSinceHalving}mo`} />
              <StatBox label="Days Post-Peak" value={daysSincePeak} sub={`${monthsSincePeak}mo`} />
              <StatBox label="Drawdown" value={`${drawdownFromATH}%`} color="#ef4444" sub={`ATH $${(ATH/1000).toFixed(0)}K`} />
              <StatBox label="Next Halving" value={daysToHalving} sub="~Mar 2028" color="#22c55e" />
            </div>

            {live.btcHigh24h && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatBox small label="24h High" value={`$${live.btcHigh24h.toLocaleString(undefined, {maximumFractionDigits: 0})}`} color="#22c55e" />
                <StatBox small label="24h Low" value={`$${live.btcLow24h.toLocaleString(undefined, {maximumFractionDigits: 0})}`} color="#ef4444" />
                <StatBox small label="Mkt Cap" value={live.btcMarketCap ? `$${(live.btcMarketCap / 1e12).toFixed(2)}T` : "—"} />

              </div>
            )}

            <Card glow>
              <SectionTitle sub="Based on 4-year halving cycle pattern">Cycle Position Indicator</SectionTitle>
              <div style={{ position: "relative", height: 48, background: "rgba(0,0,0,0.4)", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
                {[
                  { label: "Accumulation", w: "25%", bg: "rgba(34,197,94,0.15)", left: "0%" },
                  { label: "Markup", w: "20%", bg: "rgba(247,147,26,0.2)", left: "25%" },
                  { label: "Blow-off", w: "15%", bg: "rgba(239,68,68,0.2)", left: "45%" },
                  { label: "Distribution", w: "15%", bg: "rgba(239,68,68,0.12)", left: "60%" },
                  { label: "Bear / Capitulation", w: "25%", bg: "rgba(127,29,29,0.2)", left: "75%" },
                ].map((p, i) => (
                  <div key={i} style={{ position: "absolute", left: p.left, width: p.w, height: "100%", background: p.bg, borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</span>
                  </div>
                ))}
                <div style={{ position: "absolute", left: `${Math.min(95, (daysSinceHalving / (4 * 365)) * 100)}%`, top: 0, height: "100%", width: 3, background: "#F7931A", boxShadow: "0 0 10px #F7931A", zIndex: 2 }}>
                  <div style={{ position: "absolute", top: -16, left: -18, fontSize: 8, color: "#F7931A", fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>WE ARE HERE</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                <span>Halving (Apr '24)</span><span>Peak (Oct '25)</span><span>Bottom (~Oct '26)</span><span>Halving (~'28)</span>
              </div>
            </Card>

            <Card>
              <SectionTitle sub="Normalized price paths rebased to 100 at each halving">Cycle Overlay</SectionTitle>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cycleOverlay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Cycle 2 (2016)" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="Cycle 3 (2020)" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="Cycle 4 (2024)" stroke="#F7931A" strokeWidth={2.5} dot={false} />
                  <ReferenceLine x="M+18" stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" label={{ value: "Avg Peak", fill: "#ef4444", fontSize: 9 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SectionTitle>Key Pattern Observations</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "⏱", text: `Peak arrived ${CYCLE_PEAKS[3].monthsToTop}mo post-halving — matches Cycle 2 (17mo) and Cycle 3 (18mo) exactly.` },
                  { icon: "📉", text: `Current ${currentDrawdownPct}% drawdown is milder than any prior bear (77–93%). If the cycle holds, further downside is possible.` },
                  { icon: "🔄", text: `200-week MA tested for the 5th time in history. Prior touches preceded 160–330% gains within 12 months.` },
                  { icon: "📅", text: `History projects a cycle bottom ~Oct 2026 (12mo post-peak), with recovery into 2027–2028.` },
                  { icon: "🏦", text: `Strategy's new Bank Adoption Index shows only 32% average — massive institutional runway remains.` },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6, color: "#b0b0b0" }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span><span>{item.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════ TECHNICALS ═══════════════ */}
        {tab === "technicals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card glow>
              <SectionTitle sub="Short-term support/resistance — Bitcoin Foundation & FXStreet (Jul 13–15)">Key Price Levels</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <LevelRow level="$74,700" type="Major Resist" note="200-day EMA, on-chain STH cost basis area" color="#ef4444" />
                <LevelRow level="$72,200" type="Resistance" note="Short-term holder realized price" color="#ef4444" />
                <LevelRow level="$68,000" type="Resistance" note="First breakout target above pivot" color="#e07020" />
                <LevelRow level="$65,160" type="Pivot Zone" note="50-day EMA — must reclaim for bullish bias" color="#F7931A" />
                <LevelRow level={`$${currentPrice.toLocaleString(undefined,{maximumFractionDigits:0})}`} type="Current" note="Live price (auto-refreshing)" color="#ffffff" />
                <LevelRow level="$61,300" type="Support" note="20-day VWMA, immediate floor" color="#22c55e" />
                <LevelRow level="$60,000" type="Support" note="Major psychological level, confluence zone" color="#22c55e" />
                <LevelRow level="$58,300" type="Critical" note="June swing low — break opens $53K" color="#7f1d1d" />
                <LevelRow level="$53,000" type="Deep Bear" note="Realized price / 200-WMA zone" color="#7f1d1d" />
              </div>
            </Card>

            <Card>
              <SectionTitle sub="Price action heavily contested just below the 50-day EMA">Moving Averages & Momentum</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <StatBox small label="50-Day EMA" value="$65.1K" color="#ef4444" sub="ABOVE = BEARISH" />
                <StatBox small label="200-Day EMA" value="$74.7K" color="#ef4444" sub="ABOVE = BEARISH" />
                <StatBox small label="RSI (14d)" value="48.9" color="#F7931A" sub="NEUTRAL" />
                <StatBox small label="MACD" value="-202" color="#ef4444" sub="WEAKENING BEAR" />
              </div>
              {[
                { label: "Trend Structure", status: "BEARISH", color: "#ef4444", detail: "Price below both 50-day and 200-day EMAs. TradingView daily summary reads 'Sell' (12 sell, 9 neutral, 5 buy)." },
                { label: "RSI Recovery", status: "NEUTRAL", color: "#F7931A", detail: "RSI at 48.9, attempting recovery from oversold. Needs 50–55 for reversal; below 40 confirms bears." },
                { label: "MACD Signal", status: "IMPROVING", color: "#86efac", detail: "MACD line (-202) above signal (-654), histogram positive at ~452. Bearish momentum fading." },
                { label: "Supertrend", status: "DEFENSIVE", color: "#ef4444", detail: "Structural gauge still defensive despite short-term RSI recovery attempts." },
              ].map((item, i) => (
                <div key={i} style={{ padding: "10px 12px", marginBottom: 6, background: "rgba(0,0,0,0.3)", borderRadius: 6, borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#ddd" }}>{item.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: item.color, textTransform: "uppercase", padding: "2px 8px", background: `${item.color}15`, borderRadius: 3, fontFamily: "'JetBrains Mono', monospace" }}>{item.status}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "#777", lineHeight: 1.5 }}>{item.detail}</p>
                </div>
              ))}
              <p style={{ fontSize: 10, color: "#555", marginTop: 4, fontStyle: "italic" }}>
                Sources: <ExtLink href="https://bitcoinfoundation.org/news/bitcoin/bitcoin-technical-analysis-btc-nears-a-make-or-break-zone-key-levels-that-could-decide-bitcoins-next-move/">Bitcoin Foundation</ExtLink> • <ExtLink href="https://www.fxstreet.com/cryptocurrencies/news/bitcoin-price-forecast-btc-approaches-technical-pivot-as-soft-us-cpi-aids-recovery-202607151007">FXStreet</ExtLink> • <ExtLink href="https://www.economies.com/crypto/analysis/bitcoin-attempts-to-ease-oversold-conditions-%E2%80%93-analysis-%E2%80%93-14-07-2026-128403">Economies.com</ExtLink>
              </p>
            </Card>

            <Card>
              <SectionTitle>Technical Scenario Map</SectionTitle>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Scenario", "Confirmation", "Targets"].map((h, i) => <th key={i} style={{ padding: 8, textAlign: "left", color: "#666", fontWeight: 600, fontSize: 9, textTransform: "uppercase" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[
                      { s: "Bullish", c: "Close above $65,150", t: "$68K → $72.2K → $74.7K", color: "#22c55e" },
                      { s: "Neutral", c: "Hold $60K–$65,150", t: "Range-bound consolidation", color: "#F7931A" },
                      { s: "Bearish", c: "Close below $58,300", t: "$56K → $53K", color: "#ef4444" },
                    ].map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: 8, color: r.color, fontWeight: 700 }}>{r.s}</td>
                        <td style={{ padding: 8, color: "#aaa" }}>{r.c}</td>
                        <td style={{ padding: 8, color: "#ccc" }}>{r.t}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <SectionTitle sub="12-month returns after touching the 200-week moving average">200-WMA Historical Returns</SectionTitle>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={WMA_BOUNCES} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="year" tick={{ fill: "#666", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="returnPct" name="12-Mo Return" radius={[4, 4, 0, 0]}>
                    {WMA_BOUNCES.map((_, i) => <Cell key={i} fill={["#22c55e", "#86efac", "#4ade80", "#16a34a"][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: "#F7931A", marginTop: 6, textAlign: "center", fontWeight: 600 }}>BTC spent only ~4% of trading history below the 200-WMA. June 2026 = 5th touch ever.</p>
            </Card>

            {/* ── Bitbo Pro Charts ── */}
            <Card>
              <SectionTitle sub="Live professional charts — click any to open the full chart in a new tab">Professional Trading Charts</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <ChartLink href="https://www.tradingview.com/symbols/BTCUSD/technicals/" title="Daily RSI" desc="TradingView real-time RSI & oscillators" />
                  <ChartLink href="https://www.tradingview.com/symbols/BTCUSD/" title="Bollinger Bands" desc="Volatility bands on TradingView" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/200-week-moving-average-heatmap/" title="200 Week MA Heatmap" desc="Long-term cycle support level" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/mayer-multiple/" title="Mayer Multiple" desc="Price relative to 200-day MA" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/pi-cycle-top-indicator/" title="Pi Cycle Top" desc="111DMA & 350DMA×2 crossover" />
                  <ChartLink href="https://charts.bitbo.io/power-law-oscillator/" title="Power Law Oscillator" desc="Under/oversold vs power law" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/mvrv-zscore/" title="MVRV Z-Score" desc="Over/undervaluation signal" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/golden-ratio-multiplier/" title="Golden Ratio Multiplier" desc="Cycle high timing bands" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/puell-multiple/" title="Puell Multiple" desc="Miner revenue stress indicator" />
                  <ChartLink href="https://www.lookintobitcoin.com/charts/bitcoin-rainbow-chart/" title="Rainbow Chart" desc="Log regression valuation bands" />
                  <ChartLink href="https://www.coinglass.com/FundingRate" title="BTC Funding Rate" desc="Perpetual futures funding rates" />
                  <ChartLink href="https://www.coinglass.com/LiquidationHeatMap" title="Liquidation Heatmap" desc="Where leveraged positions cluster" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════ ON-CHAIN ═══════════════ */}
        {tab === "onchain" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <SectionTitle sub="Options positioning, funding, and liquidity structure">Derivatives & Market Structure</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <StatBox small label="Put/Call" value="0.56" color="#22c55e" sub="Lowest 2026" />
                <StatBox small label="Max Pain" value="$66K" color="#F7931A" sub="Options expiry" />
                <StatBox small label="Fear/Greed" value="28" color="#ef4444" sub="FEAR" />
                <StatBox small label="Funding" value="<0.01%" color="#888" sub="Below neutral" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ padding: 12, background: "rgba(34,197,94,0.05)", borderRadius: 6, border: "1px solid rgba(34,197,94,0.12)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>Cautious Optimism Signal</div>
                  <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.6 }}>Put/call at 0.56 (lowest 2026) reflects cautious optimism, not over-leveraged euphoria. Perp funding below neutral means long positioning isn't overcrowded — a healthier setup than prior bounce attempts.</p>
                </div>
                <div style={{ padding: 12, background: "rgba(239,68,68,0.05)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.12)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>Thin Liquidity Warning</div>
                  <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.6 }}>Low spot exchange volume signals thin liquidity, not broad retail conviction. ETF daily volume at $650M–$950M is ~80% below Oct 2025 peak. Glassnode 30-day avg ETF flow still negative at -$88.9M/day.</p>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle sub="Accumulation patterns and holder distribution">On-Chain Holder Metrics</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <StatBox small label="BTC at Loss" value="10.83M" color="#ef4444" />
                <StatBox small label="BTC Profit" value="9.22M" color="#22c55e" />
                <StatBox small label="LTH Losses" value="$280M/d" color="#ef4444" sub="Since Dec '22 high" />
                <StatBox small label="New 1BTC+" value="4,000+" color="#22c55e" sub="Wallets/day" />
              </div>
              <p style={{ fontSize: 12, color: "#888", lineHeight: 1.7, margin: 0 }}>
                Long-term holder metrics are mixed: 100–1K BTC wallets accumulating, 4,000+ new 1-BTC wallets daily. But LTH realized losses peaked at $280M/day — highest since Dec 2022. Simultaneous capitulation and accumulation is consistent with late-stage bear market bottoming seen in prior cycles.
              </p>
            </Card>

            <Card glow>
              <SectionTitle sub="Strategy (Saylor) Bitcoin Bank Adoption Index — Jul 13, 2026">Institutional Adoption: Bank Index</SectionTitle>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#F7931A", fontFamily: "'JetBrains Mono', monospace" }}>32%</div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Avg Adoption</div>
                </div>
                <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6, margin: 0, flex: 1 }}>
                  Covers 25 top financial institutions, scored across trading/custody, ETF/stablecoin products, digital-asset lending, and executive strategic commitment. Banking has tapped only a third of its potential.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={BANK_ADOPTION} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#555", fontSize: 10 }} />
                  <YAxis type="category" dataKey="bank" tick={{ fill: "#aaa", fontSize: 10 }} width={95} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" name="Adoption %" radius={[0, 4, 4, 0]}>
                    {BANK_ADOPTION.map((b, i) => <Cell key={i} fill={b.score > 50 ? "#22c55e" : b.score > 35 ? "#F7931A" : b.score > 20 ? "#888" : "#555"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 10, color: "#555", marginTop: 6 }}>Source: <ExtLink href="https://bitcoinfoundation.org/news/crypto-companies-news/strategy-banks-btc-index/">Bitcoin Foundation</ExtLink> • Michael Saylor / Phong Le</p>
            </Card>

            {/* On-Chain Charts */}
            <Card>
              <SectionTitle sub="Live on-chain analytics — opens in a new tab">On-Chain Charts</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <ChartLink href="https://www.blockchain.com/explorer/charts/n-transactions" title="Daily Transaction Volume" desc="Number of confirmed Bitcoin transactions per day" tag="LIVE" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/bitcoin-profitable-days/" title="Supply in Profit" desc="Percentage of circulating BTC held at a profit vs loss" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/mvrv-zscore/" title="MVRV Z-Score" desc="Market value vs realized value — identifies over/undervaluation" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/puell-multiple/" title="Puell Multiple" desc="Miner revenue relative to 365-day average — miner stress indicator" />
                <ChartLink href="https://charts.checkonchain.com/btconchain/unrealised/sopr_simple/sopr_simple_light.html" title="SOPR (Spent Output Profit Ratio)" desc="Are coins being sold at profit or loss? Key reversal signal" />
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════ CYCLES ═══════════════ */}
        {tab === "cycles" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <SectionTitle sub="Every cycle from halving to peak to trough">The Four-Year Cycle</SectionTitle>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["#", "Halving", "Peak", "Mo→Top", "Peak $", "DD%", "Bear", "Trough"].map((h, i) => <th key={i} style={{ padding: "7px 8px", textAlign: "left", color: "#666", fontWeight: 600, fontSize: 9, textTransform: "uppercase" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {CYCLE_PEAKS.map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i === 3 ? "rgba(247,147,26,0.05)" : "transparent" }}>
                        <td style={{ padding: 8, color: i === 3 ? "#F7931A" : "#999", fontWeight: 700 }}>{c.cycle}</td>
                        <td style={{ padding: 8, color: "#aaa" }}>{c.halving}</td>
                        <td style={{ padding: 8, color: "#aaa" }}>{c.peak}</td>
                        <td style={{ padding: 8, color: "#22c55e" }}>{c.monthsToTop}</td>
                        <td style={{ padding: 8, color: "#fff", fontWeight: 600 }}>${c.peakPrice.toLocaleString()}</td>
                        <td style={{ padding: 8, color: "#ef4444" }}>-{i === 3 ? currentDrawdownPct : c.drawdown}%</td>
                        <td style={{ padding: 8, color: "#aaa" }}>{c.bearMonths ? `${c.bearMonths}mo` : "—"}</td>
                        <td style={{ padding: 8, color: "#aaa" }}>{c.troughPrice ? `$${c.troughPrice.toLocaleString()}` : "TBD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <SectionTitle sub="Months from halving to peak">Time to Peak</SectionTitle>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={CYCLE_PEAKS} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="halving" tick={{ fill: "#666", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="monthsToTop" name="Months to Peak" radius={[4, 4, 0, 0]}>
                    {CYCLE_PEAKS.map((_, i) => <Cell key={i} fill={i === 3 ? "#F7931A" : "#555"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: "#666", marginTop: 6, textAlign: "center", fontStyle: "italic" }}>12 → 17 → 18 → 18 months. The cycle tightens around ~18mo post-halving.</p>
            </Card>
            <Card>
              <SectionTitle>Halving Timeline</SectionTitle>
              <div style={{ position: "relative", padding: "0 0 0 24px" }}>
                <div style={{ position: "absolute", left: 11, top: 0, bottom: 0, width: 2, background: "rgba(247,147,26,0.2)" }} />
                {HALVINGS.map((h, i) => {
                  const isPast = new Date(h.date) < new Date(); const isCurrent = i === 3;
                  return (
                    <div key={i} style={{ position: "relative", paddingBottom: 22, paddingLeft: 20 }}>
                      <div style={{ position: "absolute", left: -6, top: 4, width: 14, height: 14, borderRadius: "50%", background: isCurrent ? "#F7931A" : isPast ? "#555" : "rgba(247,147,26,0.3)", border: isCurrent ? "2px solid #F7931A" : "2px solid #333", boxShadow: isCurrent ? "0 0 12px rgba(247,147,26,0.4)" : "none" }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? "#F7931A" : isPast ? "#ccc" : "#666" }}>{h.label} — {h.date}</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Block {h.block.toLocaleString()} • Reward: {h.reward}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}


        {/* ═══════════════ SEASONALITY ═══════════════ */}
        {tab === "seasonality" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <SectionTitle sub="Average monthly returns since 2011">Bitcoin Seasonality</SectionTitle>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={SEASONALITY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="avg" name="Avg Return %" radius={[4, 4, 0, 0]}>
                    {SEASONALITY.map((s, i) => <Cell key={i} fill={i === new Date().getMonth() ? "#F7931A" : s.avg >= 0 ? "#22c55e" : "#ef4444"} opacity={i === new Date().getMonth() ? 1 : 0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SectionTitle>Seasonal Context for July 2026</SectionTitle>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: "#aaa", margin: 0 }}>
                July is historically strong (avg +10%), but bear cycle years override seasonal patterns. The real tailwind begins October (+14.5%) and peaks November (+36.5%). If the ~12mo post-peak pattern holds, Q4 2026 aligns with a potential bottom and early recovery — the window to watch.
              </p>
            </Card>
          </div>
        )}

        {/* ═══════════════ SCENARIOS ═══════════════ */}
        {tab === "scenarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <SectionTitle sub="Probability-weighted outcomes for end of 2026">Scenario Analysis</SectionTitle>
              {SCENARIO_DATA.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, marginBottom: 6, background: "rgba(0,0,0,0.3)", borderRadius: 6, border: `1px solid ${s.color}33` }}>
                  <div style={{ width: 46, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.prob}%</div>
                    <div style={{ fontSize: 8, color: "#555" }}>PROB</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ddd" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.desc}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>${(s.price / 1000).toFixed(0)}K</div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionTitle sub="What needs to happen for each outcome">Catalyst Map</SectionTitle>
              {[
                { label: "Bull ($100K–$150K)", color: "#22c55e", text: "Fed rate cuts resume, ETF inflows surge past $50B, corporate treasury adoption accelerates, cycle-is-dead narrative wins, BTC decouples from risk assets." },
                { label: "Base ($65K–$80K)", color: "#F7931A", text: "Cycle plays out normally. Bottom forms Q3–Q4 2026, ETF cost-basis floor (~$80K) provides support. Gradual recovery into 2027 pre-halving rally." },
                { label: "Bear ($38K–$55K)", color: "#ef4444", text: "Recession hits, ETF outflows accelerate, regulatory crackdown, major exchange failure. Cycle drawdown matches historical 77%+ pattern." },
              ].map((c, i) => (
                <div key={i} style={{ padding: 12, marginBottom: 8, background: "rgba(0,0,0,0.3)", borderRadius: 6, borderLeft: `3px solid ${c.color}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.label}</div>
                  <p style={{ fontSize: 11, lineHeight: 1.6, color: "#888", margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ═══════════════ AI JOURNAL ═══════════════ */}
        {tab === "journal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card glow>
              <SectionTitle sub="AI analysis from live price, cycle data, technicals, and on-chain metrics">Cycle Analysis — {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</SectionTitle>

              {/* Connection Mode */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: aiMode === "proxy" ? "#22c55e" : aiMode === "direct" ? "#F7931A" : "#555" }} />
                <span style={{ color: "#666" }}>
                  {aiMode === "proxy" ? "Server proxy (no key needed)" : aiMode === "direct" ? "Direct API (key required)" : "Auto-detect on first request"}
                </span>
                {aiMode === "proxy" && aiRemaining != null && (
                  <span style={{ color: aiRemaining > 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    {aiRemaining}/2 remaining this hour
                  </span>
                )}
              </div>

              {/* Provider Selector — only in direct mode */}
              {aiMode === "direct" && (
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[
                    { id: "gemini", label: "Gemini 3.5 Flash", tag: "FREE", tagColor: "#22c55e" },
                    { id: "claude", label: "Claude Sonnet", tag: "~$0.01", tagColor: "#F7931A" },
                  ].map(p => (
                    <button key={p.id} onClick={() => switchProvider(p.id)} style={{
                      padding: "8px 14px", display: "flex", alignItems: "center", gap: 6,
                      background: aiProvider === p.id ? "rgba(247,147,26,0.1)" : "rgba(255,255,255,0.03)",
                      border: aiProvider === p.id ? "1px solid rgba(247,147,26,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 5, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: aiProvider === p.id ? "#F7931A" : "#888", fontWeight: aiProvider === p.id ? 700 : 400,
                    }}>
                      {p.label}
                      <span style={{ fontSize: 9, color: p.tagColor, fontWeight: 700, padding: "1px 5px",
                        background: `${p.tagColor}15`, borderRadius: 3 }}>{p.tag}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* API Key — only in direct mode */}
              {aiMode === "direct" && (showKeyInput || !apiKey) && !aiAnalysis && (
                <div style={{ marginBottom: 14, padding: 14, background: "rgba(0,0,0,0.4)", borderRadius: 6, border: "1px solid rgba(247,147,26,0.2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F7931A", marginBottom: 8 }}>
                    {aiProvider === "gemini" ? "Google Gemini API Key (free)" : "Anthropic API Key (~$0.01/report)"}
                  </div>
                  <p style={{ fontSize: 11, color: "#777", lineHeight: 1.6, margin: "0 0 10px" }}>
                    {aiProvider === "gemini" ? (<>Get a free key from <ExtLink href="https://aistudio.google.com/apikey">aistudio.google.com/apikey</ExtLink>.</>) : (<>Get your key from <ExtLink href="https://console.anthropic.com/settings/keys">console.anthropic.com/settings/keys</ExtLink>.</>)}
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="password" value={apiKey} onChange={e => saveApiKey(e.target.value)}
                      placeholder={aiProvider === "gemini" ? "AIzaSy..." : "sk-ant-api03-..."}
                      style={{ flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, color: "#ccc", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
                    {apiKey && <button onClick={() => { setShowKeyInput(false); setAiError(""); }} style={{ padding: "8px 14px", background: "#F7931A", color: "#0a0a0a", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>Save</button>}
                  </div>
                </div>
              )}

              {aiError && (
                <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, fontSize: 11, color: "#ef4444", lineHeight: 1.5 }}>
                  {aiError}
                </div>
              )}

              {!aiAnalysis && !aiLoading && (aiMode !== "direct" || apiKey) && (
                <button onClick={fetchAiAnalysis} style={{ padding: "12px 24px", background: "#F7931A", color: "#0a0a0a", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                  Generate Today's Analysis
                </button>
              )}

              {aiLoading && (
                <div style={{ padding: 20, textAlign: "center", color: "#F7931A", fontSize: 13 }}>
                  <div style={{ animation: "pulse 1.5s infinite", fontSize: 24, marginBottom: 8 }}>₿</div>
                  {aiMode === "proxy" ? "Generating via server..." : `Analyzing via ${aiProvider === "gemini" ? "Gemini" : "Claude"}...`}
                </div>
              )}

              {aiAnalysis && (
                <>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                    {aiMode === "proxy"
                      ? `Powered by Gemini 3.5 Flash via server \u2022 ${aiRemaining != null ? aiRemaining + "/2 reports remaining" : ""}`
                      : `Powered by ${aiProvider === "gemini" ? "Gemini 3.5 Flash" : "Claude Sonnet 4.6"} (direct)`}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.8, color: "#b0b0b0", whiteSpace: "pre-wrap" }}>{aiAnalysis}</div>
                  <button onClick={() => { setAiAnalysis(""); setAiError(""); setAiRemaining(null); }} style={{
                    marginTop: 12, padding: "6px 14px", background: "rgba(255,255,255,0.05)", color: "#888",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, cursor: "pointer",
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                  }}>Regenerate</button>
                </>
              )}

            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionTitle>Live Data Snapshot</SectionTitle>
                <button onClick={() => setShowKeyInput(s => !s)} title="API Key Settings" style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3,
                  color: apiKey ? "#22c55e" : "#ef4444", cursor: "pointer", padding: "3px 8px",
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                }}>🔑 {apiKey ? "Key Set" : "No Key"}</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <StatBox small label="BTC Live" value={`$${(currentPrice / 1000).toFixed(1)}K`} />
                <StatBox small label="From ATH" value={`${drawdownFromATH}%`} color="#ef4444" />
                <StatBox small label="200-WMA" value="YES" color="#F7931A" sub="Zone test" />
                <StatBox small label="Post-Peak" value={`${monthsSincePeak}mo`} />
                <StatBox small label="RSI" value="48.9" color="#F7931A" />
                <StatBox small label="P/C Ratio" value="0.56" color="#22c55e" />
                <StatBox small label="Fear/Greed" value="28" color="#ef4444" sub="Fear" />
                <StatBox small label="Bank Adopt" value="32%" color="#F7931A" sub="Strategy" />
              </div>
            </Card>

            <Card>
              <SectionTitle>The Debate: Is the 4-Year Cycle Dead?</SectionTitle>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 230, padding: 12, background: "rgba(34,197,94,0.05)", borderRadius: 6, border: "1px solid rgba(34,197,94,0.15)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 6 }}>THE CYCLE LIVES</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.7, color: "#888" }}>
                    <li>Peak at 18mo post-halving — on schedule</li>
                    <li>{currentDrawdownPct}% drawdown follows diminishing trend</li>
                    <li>200-WMA test matches all prior bottoms</li>
                    <li>Fidelity's Timmer: Oct '25 was the cycle top</li>
                    <li>CCN: projected bottom ~Oct 2026</li>
                  </ul>
                </div>
                <div style={{ flex: 1, minWidth: 230, padding: 12, background: "rgba(239,68,68,0.05)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>THE CYCLE IS DEAD</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.7, color: "#888" }}>
                    <li>ETFs move $500M+/day vs $40M mining supply</li>
                    <li>$80K ETF cost basis = structural floor</li>
                    <li>Epoch: "Cycle theory is a relic"</li>
                    <li>Bank adoption only 32% — runway ahead</li>
                    <li>Grayscale: "slow bull" institutional era</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* ── Key Indicator Charts ── */}
            <Card>
              <SectionTitle sub="Essential cycle and sentiment indicators">Market Indicators</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <ChartLink href="https://alternative.me/crypto/fear-and-greed-index/" title="Fear & Greed Index" desc="Sentiment analysis — price colored by fear (red) vs greed (green)" tag="SENTIMENT" />
                <ChartLink href="https://www.tradingview.com/symbols/BTCUSD/technicals/" title="Relative Strength Index (RSI)" desc="Momentum indicator — overbought vs oversold" tag="MOMENTUM" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/bitcoin-profitable-days/" title="Supply in Profit" desc="% of BTC supply held at a profit — key cycle position signal" tag="ON-CHAIN" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/golden-ratio-multiplier/" title="Golden Ratio Multiplier" desc="Cycle high timing bands — are we near a top?" tag="VALUATION" />
                <ChartLink href="https://charts.bitbo.io/power-law-oscillator/" title="Power Law Oscillator" desc="Under/oversold relative to power law fit — tops and bottoms" tag="VALUATION" />
                <ChartLink href="https://www.lookintobitcoin.com/charts/mvrv-zscore/" title="MVRV Z-Score" desc="Market value vs realized value — over/undervaluation" tag="ON-CHAIN" />
              </div>
            </Card>

            {/* ── Bear Market History (moved from Bears tab) ── */}
            <Card>
              <SectionTitle sub="Peak-to-bottom drop in every bear cycle">How Far Does BTC Crash?</SectionTitle>
              {dynamicBearDrawdowns.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 60, fontSize: 12, fontWeight: 700, color: i === 4 ? "#F7931A" : "#ccc", fontFamily: "'JetBrains Mono', monospace" }}>{b.year}</div>
                  <div style={{ flex: 1, height: 30, background: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${b.drawdown}%`, height: "100%", background: `linear-gradient(90deg, ${b.color}cc, ${b.color}88)`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, transition: "width 1s ease" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>-{b.drawdown}%{i === 4 ? " live" : ""}</span>
                    </div>
                  </div>
                  <div style={{ width: 50, textAlign: "right", fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>{b.months ? `${b.months}mo` : "—"}</div>
                </div>
              ))}
              <p style={{ fontSize: 11, color: "#666", marginTop: 8, textAlign: "center" }}>93% → 86% → 84% → 77% → {Math.round(currentDrawdownPct)}% live. Diminishing severity — but this cycle may not be finished.</p>
            </Card>
            <Card>
              <SectionTitle sub="From ATH of $126K">Bear Case Scenarios</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "Bull (low is in)", pct: 52, price: "$59K", color: "#22c55e", border: "rgba(34,197,94,0.3)" },
                  { label: "Base (historical)", pct: 64, price: "$45K", color: "#F7931A", border: "rgba(247,147,26,0.3)" },
                  { label: "Bear (macro shock)", pct: 70, price: "$38K", color: "#ef4444", border: "rgba(239,68,68,0.3)" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 130, padding: 14, textAlign: "center", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: `1px solid ${s.border}` }}>
                    <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>-{s.pct}%</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#ccc", marginTop: 4 }}>{s.price}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

      </main>

      {/* ═══ COIN SIDEBAR ═══ */}
      <aside style={{
        width: 210, flexShrink: 0, paddingTop: 18, position: "sticky", top: 10,
        maxHeight: "calc(100vh - 20px)", overflowY: "auto",
        display: typeof window !== "undefined" && window.innerWidth < 768 ? "none" : "block",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8, padding: "12px 10px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e5e5e5", textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            Top 20 by Market Cap
          </div>
          {topCoins.loading && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: 12 }}>Loading...</div>}
          {topCoins.coins.map((coin, i) => {
            const isPositive = coin.change24h >= 0;
            return (
              <div key={coin.id} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: i === 0 ? "rgba(247,147,26,0.05)" : "transparent",
              }}>
                <span style={{ fontSize: 9, color: "#555", fontFamily: "'JetBrains Mono', monospace",
                  width: 16, textAlign: "right", flexShrink: 0 }}>{coin.rank}</span>
                <img src={coin.image} alt="" width={14} height={14}
                  style={{ borderRadius: "50%", flexShrink: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#ddd", lineHeight: 1.2 }}>{coin.symbol}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#ccc", fontFamily: "'JetBrains Mono', monospace" }}>
                    {coin.price >= 1000 ? `$${(coin.price/1000).toFixed(1)}K`
                      : coin.price >= 1 ? `$${coin.price.toFixed(2)}`
                      : `$${coin.price.toFixed(4)}`}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                    color: isPositive ? "#22c55e" : "#ef4444" }}>
                    {isPositive ? "+" : ""}{coin.change24h?.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 8, color: "#333", textAlign: "center", marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace" }}>
            Auto-refresh • 60s
          </div>
        </div>
      </aside>

      </div>{/* end content+sidebar flex */}

      {/* ═══ FOOTER ═══ */}
      <footer style={{ marginTop: 28, padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "#444", textAlign: "center", lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>Educational and informational purposes only. Not financial advice. Past performance ≠ future results.</p>
        <div style={{ marginTop: 6, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", fontSize: 9 }}>
          <ExtLink href="https://www.binance.com/en/price/bitcoin">Binance</ExtLink>
          <ExtLink href="https://www.lookintobitcoin.com/charts/">LookIntoBitcoin</ExtLink>
          <ExtLink href="https://bitcoinfoundation.org/news/bitcoin/bitcoin-technical-analysis-btc-nears-a-make-or-break-zone-key-levels-that-could-decide-bitcoins-next-move/">BTC Foundation</ExtLink>
          <ExtLink href="https://bitcoinfoundation.org/news/crypto-companies-news/strategy-banks-btc-index/">Strategy Index</ExtLink>
          <ExtLink href="https://www.fxstreet.com/cryptocurrencies/news/bitcoin-price-forecast-btc-approaches-technical-pivot-as-soft-us-cpi-aids-recovery-202607151007">FXStreet</ExtLink>
          <ExtLink href="https://www.coingecko.com/learn/bitcoin-price-predictions-expert-forecasts">CoinGecko</ExtLink>
        </div>
        <p style={{ margin: "6px 0 0", color: "#333" }}>Price data: CoinGecko API • Auto-refresh: {refreshInterval > 0 ? `${refreshInterval/1000}s` : "OFF"}</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @media (max-width: 850px) {
          aside { display: none !important; }
        }
        aside::-webkit-scrollbar { width: 3px; }
        aside::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
      `}</style>
    </div>
  );
}
