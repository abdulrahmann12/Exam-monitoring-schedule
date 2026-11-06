# Uni-Guard Schedules — web app

React + Vite + TypeScript frontend for Uni-Guard Schedules (exam invigilation planning).
The backend is the separate repository `Exam-monitoring-schedule-backend` (Spring Boot).

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

In development every `/api` call is forwarded to the backend at `VITE_DEV_API_PROXY_TARGET`
(`.env.development`, default `http://localhost:8080`), so the app and the API share one address and the
HttpOnly sign-in cookies work. Start the backend first (see its README, "Locally without MySQL").

## Checks

```bash
npm test             # unit and component tests (Vitest)
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build        # production build in dist/
```

## Settings

| Variable | Used | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | production build | Address of the backend. Leave empty when the hosting forwards `/api` to the backend (recommended: same site, so cookies always work) |
| `VITE_DEV_API_PROXY_TARGET` | `npm run dev` | Backend address for the development proxy |

## Deploying on Vercel

`vercel.json` forwards `/api/*` to the backend on Hugging Face and serves `index.html` for every page address
(so refreshing any page works). The app and the API then count as one site, so sign-in cookies work in every
browser. Leave `VITE_API_BASE_URL` empty (and not set in the Vercel project). Full steps: the backend's
`docs/DEPLOYMENT.md`.
