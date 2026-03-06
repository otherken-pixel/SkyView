# FlightScore: Production & Mobile Architecture Plan

## Current State Assessment

FlightScore is a preflight weather & risk briefing app built as a **single-file SPA** (`public/index.html` — ~9,800 lines) with:

- **React 18** loaded via CDN (`unpkg.com`), **Babel standalone** compiling JSX in the browser
- **Firebase** backend: Auth, Firestore, Cloud Functions (`geminiProxy`, `weatherProxy`)
- **No build step** — all CSS, JS, and component logic inlined in one HTML file
- **Basic PWA** — service worker with stale-while-revalidate caching
- **Firebase App Hosting** — minimal Node.js static file server
- **Unused Vite scaffold** at `public/web-app/` (never integrated)
- **Firebase Data Connect** (PostgreSQL) — appears to be in early setup

This architecture works for prototyping but has **critical blockers** for production and mobile deployment.

---

## Architecture Changes Required

### 1. CRITICAL — Extract the Monolith into a Real Build Pipeline

**Problem:** The entire app lives in a single 9,800-line HTML file with in-browser Babel compilation. This means:
- ~1MB+ parse/compile overhead on every page load (Babel standalone is ~800KB)
- No tree-shaking, no code splitting, no minification
- No TypeScript, no linting, no static analysis
- Impossible to share code between web and mobile
- Cannot use npm packages (everything loaded via CDN `<script>` tags)

**What to do:**
- Migrate the app into the existing `public/web-app/` Vite + React scaffold
- Break `index.html` into proper React components (roughly 15-25 component files)
- Move CSS into CSS modules or a utility framework (Tailwind recommended for cross-platform consistency)
- Use `npm` dependencies instead of CDN script tags (React, Leaflet, PapaParse, etc.)
- Add TypeScript (optional but strongly recommended for a production app)

**Suggested component breakdown:**
```
src/
├── components/
│   ├── auth/          # Login, Register, AuthProvider
│   ├── weather/       # METAR display, TAF display, weather cards
│   ├── briefing/      # Flight briefing, risk assessment, go/no-go
│   ├── map/           # Leaflet map, airport markers
│   ├── layout/        # Header, Navigation, Hamburger menu
│   └── common/        # Buttons, Cards, Loading states
├── hooks/             # useAuth, useWeather, useBriefing
├── services/          # Firebase init, API calls (geminiProxy, weatherProxy)
├── utils/             # METAR parsing, scoring logic, formatters
└── styles/            # Design tokens, global styles
```

### 2. CRITICAL — Create a Shared API/Service Layer

**Problem:** Firebase SDK calls and business logic are scattered throughout inline `<script>` tags using `window.firebaseAuth` globals. Mobile apps cannot use this.

**What to do:**
- Create a `services/` layer that encapsulates all Firebase interactions:
  - `services/auth.ts` — sign in, sign up, sign out, auth state listener
  - `services/firestore.ts` — user profile CRUD, saved briefings
  - `services/weather.ts` — calls to `weatherProxy` Cloud Function
  - `services/ai.ts` — calls to `geminiProxy` Cloud Function
- This service layer becomes the **shared contract** between web and mobile

### 3. CRITICAL — Choose a Mobile Strategy

You have three realistic options:

| Approach | Pros | Cons | Recommended? |
|----------|------|------|:---:|
| **React Native + Expo** | Shares React knowledge, huge ecosystem, true native UI | Separate UI layer from web, two codebases to maintain | Good if you want native feel |
| **Capacitor (Ionic)** | Wraps your existing web app in a native shell, one codebase | Performance ceiling, limited native API access | **Best for your situation** |
| **Flutter** | Excellent performance, single codebase for iOS/Android/web | Requires learning Dart, complete rewrite | Only if starting fresh |

**Recommendation: Capacitor** — Given that FlightScore is already a web app with PWA support, Capacitor lets you:
- Wrap the production web build in native iOS/Android shells
- Access native APIs (GPS, push notifications, background fetch) via plugins
- Ship to App Store and Play Store with minimal additional code
- Keep a single codebase for web + mobile

### 4. HIGH — Secure the Firebase Configuration

**Problem:** Firebase config (API keys, project IDs) is embedded in `index.html` at line ~812. The Cloud Functions have `invoker: "public"` with no rate limiting.

**What to do:**
- Move Firebase config to environment variables loaded at build time (`import.meta.env`)
- Add **Firebase App Check** to prevent API abuse from unauthorized clients
- Add rate limiting to Cloud Functions (Firebase doesn't do this natively — use a Firestore counter or Cloud Armor)
- Review Firestore rules — current rules are good (user-scoped auth) but add validation rules for document structure
- Remove the `SECURITY.md` boilerplate — it contains fake version numbers and no real policy

### 5. HIGH — Implement Proper Environment Management

**Problem:** No `.env` files, no environment separation, no build-time configuration.

**What to do:**
```
.env.development    # Local emulator config
.env.staging        # Staging Firebase project
.env.production     # Production Firebase project
```

Key variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### 6. HIGH — Upgrade the Service Worker / PWA

**Problem:** Current service worker (`sw.js`) is minimal. The PWA manifest is inlined as a data URI (no icon files, no screenshots, won't pass App Store review for TWA).

**What to do:**
- Create a proper `manifest.json` with multiple icon sizes (192x192, 512x512)
- Generate actual PNG icons from the SVG favicon
- Add offline fallback page
- Implement cache versioning tied to build hash
- Use Workbox (via Vite plugin) instead of hand-rolled service worker

### 7. MEDIUM — Add Error Tracking & Analytics

**Problem:** No error tracking, no analytics, no crash reporting. Production apps need observability.

**What to do:**
- Add **Sentry** (or Firebase Crashlytics for mobile) for error tracking
- Add **Firebase Analytics** / Google Analytics for usage metrics
- Add structured logging in Cloud Functions (already using `firebase-functions/logger`, which is good)

### 8. MEDIUM — Add Testing

**Problem:** Zero tests. No unit tests, no integration tests, no E2E tests.

**What to do (minimum viable):**
- Unit tests for METAR parsing / scoring logic (these are pure functions — easy wins)
- Integration tests for Cloud Functions (firebase-functions-test is already in devDependencies)
- E2E test for critical path: login → search airport → view briefing (Playwright or Cypress)

### 9. MEDIUM — Set Up CI/CD

**Problem:** No CI/CD pipeline. Manual deployment only.

**What to do:**
- GitHub Actions workflow:
  1. Lint + type check
  2. Run tests
  3. Build web app
  4. Deploy to Firebase Hosting (staging on PR, production on merge to main)
- For mobile: add Fastlane or EAS Build (Expo) for iOS/Android builds

### 10. LOW — Clean Up Unused Code

- Remove or integrate the `public/web-app/` Vite scaffold (currently unused)
- Remove `faa_charts_download.py` if not needed in production
- Remove the `public/dataconnect/` directory if Data Connect is not being used yet
- Update `SECURITY.md` with real content or remove it

---

## Recommended Implementation Order

```
Phase 1 — Foundation (do this first)
  ├── 1. Extract monolith into Vite build pipeline
  ├── 2. Create shared service layer
  └── 3. Add environment management

Phase 2 — Production Hardening
  ├── 4. Firebase App Check + security review
  ├── 5. Upgrade PWA / service worker
  ├── 6. Add error tracking
  └── 7. Add minimum viable tests + CI/CD

Phase 3 — Mobile
  ├── 8. Add Capacitor to the Vite project
  ├── 9. Configure iOS + Android projects
  ├── 10. Add native plugins (GPS, push notifications)
  └── 11. Submit to App Store + Play Store
```

Phase 1 is the prerequisite for everything else. The monolith extraction is the single biggest piece of work but unlocks all subsequent improvements.
