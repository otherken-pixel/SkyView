FlightScore ✈️

FlightScore is a single-page, React-based aviation trip planning dashboard. It provides pilots with live weather data (METARs/TAFs from AviationWeather.gov), NWS 7-day forecasts, an interactive Windy.com radar map, NOTAMs, frequency guides, route mapping, and AI-powered flight briefings via Claude—all wrapped in a modern Material Design 3 (Material You) interface.

🌟 Features

Live Weather Data: Real-time METARs and TAFs fetched directly from the Aviation Weather Center API (aviationweather.gov). A "LIVE" badge confirms live data is loaded.
Live Go/No-Go Score: Trip cards compute a Go/No-Go score from actual flight categories and winds in the live METARs. The ring updates a few seconds after the page loads.
NWS 7-Day Forecast: Pulls real daily forecasts from api.weather.gov for each airport on your route ("NWS LIVE" badge).
Windy.com Radar Map: An embedded interactive wind and radar overlay in the Weather tab, auto-centered on your route midpoint.
AI Flight Briefing (Claude): Pre-fetches live METARs and TAFs for all waypoints, then sends them to Claude (claude-sonnet-4-6) for a comprehensive Go/No-Go briefing. Requires an Anthropic API key entered in the UI.
Interactive Route Map: Leaflet map with CartoDB Voyager tiles (Google Maps-style) showing the full flight path, airport labels, total distance, and initial heading.
Route Builder: Plan flights with up to 5 legs using any valid 4-letter ICAO code. Unknown ICAOs are resolved automatically via the AWC API.
Material Design 3 UI: Automatically adapts to your system Light or Dark mode.
Zero-Build Setup: Runs entirely in the browser via React and Babel CDNs. No npm or build step needed.

🚀 How to Run Locally

Option 1 — Python server (recommended, fixes Windy.com iframe):
  cd SkyView
  python3 -m http.server 8080
  Then open http://localhost:8080 in your browser.

Option 2 — Open directly:
  Double-click index.html to open it in Chrome, Firefox, or Safari.
  Note: The Windy.com radar iframe may be blocked by some browsers on file:// URLs.

📱 View on Your Phone

Start the server bound to all interfaces:
  python3 -m http.server 8080 --bind 0.0.0.0

Find your machine's local IP:
  hostname -I | awk '{print $1}'

Make sure your phone is on the same Wi-Fi network, then open:
  http://<your-ip>:8080

🔑 Enabling the AI Briefing Feature

The AI briefing uses Anthropic's Claude API. You need an Anthropic API key:
  1. Get a key at https://console.anthropic.com/
  2. Open a trip → go to the Briefing tab
  3. Paste your API key into the "Anthropic API Key" field
  4. Click "Generate AI Briefing"

Your key is never stored — it lives only in your browser session.

Live weather data (METARs and TAFs) is automatically fetched for all waypoints before Claude is called, so the briefing is based on real current conditions.

🌐 Hosting on GitHub Pages (Free)

Since this is a single static HTML file, you can host it for free using GitHub Pages:
  1. Go to your repository on GitHub.
  2. Click Settings → Pages.
  3. Under "Build and deployment", select Deploy from a branch.
  4. Select the main branch and / (root) folder, then click Save.
  5. GitHub will provide a live URL within a minute or two.

Note: Live API calls (AviationWeather.gov, NWS, Windy.com, Anthropic) all work fine from GitHub Pages since they are CORS-enabled or embedded via iframe.

⚠️ Disclaimer

For situational awareness and flight planning assistance only. The Pilot in Command (PIC) is solely responsible for making final Go/No-Go decisions using official, FAA-approved weather sources and briefing services.
