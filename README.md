# Betting UI — Football Betting Strategy Analyzer

A [Next.js](https://nextjs.org) (App Router) web application that implements a football betting risk-mitigation strategy. It ingests football match odds, identifies specific betting structures (**Anchors**, **Hedges**, **Unicorns**), and displays an interactive 3x3 matrix and a paginated betslip viewer that distribute a user-defined monetary spread across the identified bets.

## How it works

1. **Data ingestion** — the app loads football matches with 1X2 odds (`home_win`, `draw`, `away_win`) from a live SportPesa scrape, with a static fallback file at `public/betgames.json`.
2. **Classification** — each game is parsed and categorized by `utils/bettingLogic.ts`:
   - **Anchors**: `w`, `d`, and `l` odds all between 2.1 and 3.9
   - **Unicorns**: `d >= 5 * w` and `l >= 1.5 * d`
   - **Hedges**: `d >= 3 * w` and `l >= 1.5 * d`
3. **Stake distribution** — you pick Anchor games and extra legs (Hedges/Unicorns), set a monetary spread, and the UI builds paired anchor combos plus individual bets, showing stake and payout for each ticket in a paginated betslip viewer.

## Tech stack

- **Framework:** Next.js (React 19, App Router)
- **Styling:** Tailwind CSS
- **Icons:** lucide-react
- **State:** React hooks (`useState`, `useMemo`, `useEffect`)
- **Scraping:** headless Chromium (`@sparticuz/chromium` + `chrome-remote-interface`) for live SportPesa odds

## Getting started

Install dependencies and run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The app runs on **port 3000** and is deployed to a VPS via **Coolify**:

1. GitHub Actions builds a Docker image and pushes it to GHCR (`docker/build-push-action`).
2. Actions then triggers the Coolify deploy webhook for this app.
3. Coolify pulls the image and routes `https://betcalc.work.gd` → container port 3000 behind its own Traefik/Caddy proxy (no host nginx; 80/443 belong to the Coolify proxy).

Required GitHub secrets: `COOLIFY_WEBHOOK` (this resource's deploy webhook) and optionally `COOLIFY_TOKEN` if the webhook requires a Bearer token.

See [`docs/agents/COOLIFY_BETTINGUI.md`](docs/agents/COOLIFY_BETTINGUI.md) for the full migration checklist (port ownership, compose layout, DNS, and rollback notes).
