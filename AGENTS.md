# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Frontend (Vite) | `npm run dev` | 5173 | Proxies `/api` to mock server |
| Mock server | `npm run mock` | 3002 | In-memory data store; restarts clear data |
| Both together | `npm run dev:all` | 5173 + 3002 | Recommended for local dev |

### Running the app

Use `WAVEGUARD_USE_MOCK_SCAN=true npm run dev:all` to start both services with mock network scanning (no live LAN access needed). The app is accessible at `http://localhost:5173`. No login is required in dev mode — the mock server auto-authenticates.

### Lint / Typecheck / Build

Standard commands documented in `package.json` scripts and `README.md`:
- `npm run lint` — ESLint (the repo has pre-existing unused-import warnings that are not blocking)
- `npm run typecheck` — TypeScript checking
- `npm run build` — Production build

### Key gotchas

- The mock server stores all data **in-memory**. Restarting it clears all equipment, cables, tasks, etc.
- The `scanner/` directory has no separate `package.json` dependencies — it is imported directly by the mock server.
- The Vite dev server proxies `/api` requests to `http://localhost:3002`. The mock server must be running for API calls to work.
- The `Add Equipment` form silently fails if both Name and Model fields are not filled (validated in `InventoryPage.jsx`).
