# Vercel + Render + MongoDB Setup

This project now supports a Mongo backend server at `server/index-mongo.js`.

## 1) Local Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables in root `.env`:

```env
MONGODB_URI=your_atlas_connection_string
PORT=3000
VITE_API_URL=/api
```

3. (Optional but recommended) migrate existing MySQL data into MongoDB:

```bash
npm run migrate:mysql-to-mongo
```

This copies data from your current MySQL database (`DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`) into Mongo collections used by `server/index-mongo.js`.

4. Start Mongo backend:

```bash
npm run server:mongo
```

If `3000` is already in use (for example by `npm run server`), stop that process first or set a different `PORT` in `.env`.

5. Start frontend dev server:

```bash
npm run dev
```

## 2) MongoDB Atlas

1. Create a free cluster.
2. Create database user credentials.
3. In Network Access, allow `0.0.0.0/0` for initial testing.
4. Copy the connection string and place it in `MONGODB_URI`.

## 3) Render Backend Deployment

This repository includes `render.yaml`.

1. Push your code to GitHub.
2. In Render, create a new Blueprint (or Web Service from repo).
3. If using Web Service manually:
   - Build Command: `npm install`
   - Start Command: `npm run server:mongo`
4. Add environment variable:
   - `MONGODB_URI` = your Atlas URI
5. Deploy.

Your backend API URL will be:

```text
https://<your-render-service>.onrender.com/api
```

## 4) Vercel Frontend Deployment

1. Import the same GitHub repo in Vercel.
2. Framework: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variable in Vercel project settings:

```env
VITE_API_URL=https://<your-render-service>.onrender.com/api
```

6. Redeploy Vercel after setting env vars.

## 5) Quick Verification

1. Render health endpoint:

```text
https://<your-render-service>.onrender.com/api/health
```

2. Vercel frontend URL loads and can perform:
   - student search
   - attendance logs
   - events and fines actions

## Notes

- Existing MySQL backend remains at `server/index.js`.
- Mongo backend is reversible and isolated at `server/index-mongo.js`.
- Free tiers can sleep when inactive; first request may be slower.
