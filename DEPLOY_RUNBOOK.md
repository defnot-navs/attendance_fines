# Deployment Runbook

## 1. Service Responsibilities
- Render hosts backend API only.
- Vercel hosts frontend only.
- Backend start command must remain `npm run server:mongo`.

## 2. Deployment Order
1. Push backend/frontend changes to `main`.
2. Verify Render deploy commit hash matches latest commit.
3. Verify Vercel deploy commit hash matches latest commit.

## 3. Two-Minute API Smoke Test
Run after every Render deployment:

```bash
npm run smoke:render
```

Expected passing checks:
- `GET /api/health` returns `200`
- `GET /api/students` returns `200`
- `GET /api/fines-summary` returns `200`

If all pass, proceed to frontend QA.

## 4. PWA Cache Safety Steps
After each major Vercel deployment:
1. Hard refresh once (`Ctrl+Shift+R`).
2. If UI still looks old: unregister service worker and reload.

## 5. Free-Tier Cold Start Handling
- First Render request may be slow after inactivity.
- Judge performance on second request (warm response), not first request.

## 6. Fast Debug Rules
- If commit hash is wrong: redeploy latest commit with clear cache.
- If commit hash is correct but UI is wrong: assume client cache first.
- If smoke test fails: fix backend before testing frontend behavior.
