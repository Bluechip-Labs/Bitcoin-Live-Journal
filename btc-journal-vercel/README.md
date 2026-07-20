# ₿ Bitcoin Live Journal

Live Bitcoin cycle analysis dashboard with auto-refreshing prices, historical cycle comparison, technical analysis, on-chain metrics, and AI-powered journal entries.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Price data works immediately via direct CoinGecko calls. AI analysis requires entering your own API key on the AI Journal tab (the server proxy routes aren't available in local-only mode).

## Deploy to Vercel (Free)

### Step 1: Push to GitHub

1. Create a GitHub account at github.com if you don't have one
2. Create a new repository (e.g., `bitcoin-live-journal`)
3. In this project folder, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bitcoin-live-journal.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **"Add New Project"**
3. Import your `bitcoin-live-journal` repository
4. Vercel auto-detects Vite — click **Deploy**
5. Your site is live at `https://bitcoin-live-journal.vercel.app` (or similar)

### Step 3: Add Your Gemini API Key

1. In your Vercel project dashboard, go to **Settings → Environment Variables**
2. Add: `GEMINI_API_KEY` = your key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. Click **Save**
4. Go to **Deployments** and click the three dots → **Redeploy**

That's it. The AI Journal tab will now work for all visitors without them needing a key.

### Optional: Custom Domain

1. Buy a domain (~$10-15/year) from Namecheap or Cloudflare
2. In Vercel: Settings → Domains → Add your domain
3. Update your DNS records as Vercel instructs

## Architecture

```
/
├── api/
│   ├── price.js      # Cached CoinGecko proxy (refreshes every 15s, serves cached to all)
│   └── analyze.js    # Gemini AI proxy (rate limited to 2 requests/hour per IP)
├── src/
│   ├── BitcoinLiveJournal.jsx   # Main React app
│   ├── App.jsx                  # Wrapper
│   └── main.jsx                 # Entry point
├── index.html
├── vercel.json        # Vercel configuration
├── vite.config.js     # Build config
└── package.json
```

### How the Proxy Works

**Price Caching (`/api/price`):**  
One serverless function fetches CoinGecko every 15 seconds and caches the result. All visitors get served from the cache instead of each hitting CoinGecko directly. This prevents rate limiting even with hundreds of concurrent users.

**AI Rate Limiting (`/api/analyze`):**  
Each visitor's IP is limited to 2 AI report generations per hour. The Gemini API key lives as a server-side environment variable — visitors never see it. If someone spams the button they get a clear "try again in X minutes" message.

**Auto-Fallback:**  
When running locally without Vercel, the app automatically detects that `/api/price` returns 404 and falls back to direct CoinGecko calls from the browser. Same for AI — it falls back to asking for a personal API key.

## Cost

- **Vercel hosting:** Free (hobby plan)
- **CoinGecko API:** Free (public endpoint)
- **Gemini AI:** Free (Google AI Studio free tier: 1,500 requests/day)
- **Custom domain:** ~$10-15/year (optional)

**Total: $0/month**
