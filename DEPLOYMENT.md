# Deployment Guide

This guide covers deploying the Expense Sharing Application to production.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     runelabs.dev                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   www.runelabs.dev          api.runelabs.dev               │
│   ┌─────────────┐           ┌─────────────┐                │
│   │   Vercel    │           │   Railway   │                │
│   │  (Frontend) │  ──────►  │  (Backend)  │                │
│   │  React/Vite │           │  Node.js    │                │
│   └─────────────┘           └──────┬──────┘                │
│                                    │                        │
│                         ┌─────────┴─────────┐              │
│                         │                   │              │
│                    ┌────▼────┐        ┌────▼────┐          │
│                    │ MongoDB │        │  Redis  │          │
│                    │  Atlas  │        │(Railway)│          │
│                    └─────────┘        └─────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. MongoDB Atlas Setup

If not already done:

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Create database user with read/write access
4. Whitelist `0.0.0.0/0` for network access (or Railway's IPs)
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/expense-sharing?retryWrites=true&w=majority
   ```

---

## 2. Backend Deployment (Railway)

### Step 1: Create Railway Account
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your repository
4. **Important**: Set the root directory to `server` (the server folder is self-contained with its own `shared` folder)

### Step 3: Add Redis
1. In your project, click "New"
2. Select "Database" → "Add Redis"
3. Railway will automatically set `REDIS_URL`

### Step 4: Configure Environment Variables
In Railway dashboard, go to your service → Variables:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense-sharing
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
CORS_ORIGIN=https://www.runelabs.dev,https://runelabs.dev
USE_BALANCE_V2=true
```

Note: `REDIS_URL` is automatically set by Railway when you add Redis.

### Step 5: Configure Custom Domain
1. Go to Settings → Domains
2. Click "Add Custom Domain"
3. Enter: `api.runelabs.dev`
4. Railway will show you the CNAME target (e.g., `your-app.up.railway.app`)

### Step 6: Deploy
Railway auto-deploys on git push. Check logs for:
```
✅ MongoDB connected
✅ Redis connected
✅ Distributed lock manager initialized
✅ Job queues initialized
🚀 Server running on port 5000
```

---

## 3. Frontend Deployment (Vercel)

### Step 1: Create Vercel Account
1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub

### Step 2: Import Project
1. Click "Add New" → "Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Configure Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://api.runelabs.dev/api
```

### Step 4: Configure Custom Domain
1. Go to Settings → Domains
2. Add `runelabs.dev` and `www.runelabs.dev`
3. Vercel will show DNS configuration

---

## 4. DNS Configuration (name.com)

Log into name.com and add these DNS records:

### For Frontend (Vercel)

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 300 |
| CNAME | www | cname.vercel-dns.com | 300 |

### For Backend (Railway)

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | api | your-app.up.railway.app | 300 |

Replace `your-app.up.railway.app` with the actual Railway domain shown in your dashboard.

### Verification
After DNS propagation (5-30 minutes):
- `https://www.runelabs.dev` → Frontend
- `https://api.runelabs.dev/health` → Backend health check

---

## 5. SSL/HTTPS

Both Vercel and Railway automatically provision SSL certificates. No manual configuration needed.

---

## 6. Post-Deployment Checklist

### Backend Verification
```bash
# Health check
curl https://api.runelabs.dev/health

# Expected response:
{
  "status": "ok",
  "services": {
    "redis": "connected",
    "locks": 0
  },
  "queues": {
    "activities": { "processed": 0, "failed": 0, "pending": 0 },
    "balances": { "processed": 0, "failed": 0, "pending": 0 }
  }
}
```

### Frontend Verification
1. Open `https://www.runelabs.dev`
2. Open browser DevTools → Network tab
3. Sign up/login and verify API calls go to `https://api.runelabs.dev`
4. No mixed content warnings

### CLI Configuration
```bash
# Set production API URL
set EXPENSE_API_URL=https://api.runelabs.dev/api
expense-cli login -e your@email.com -p yourpassword
```

---

## 7. Troubleshooting

### CORS Errors
- Verify `CORS_ORIGIN` in Railway includes your frontend domain
- Include both `https://runelabs.dev` and `https://www.runelabs.dev`

### Mixed Content Errors
- Ensure `VITE_API_URL` uses `https://` not `http://`
- Redeploy frontend after changing environment variables

### MongoDB Connection Issues
- Verify IP whitelist in Atlas (use `0.0.0.0/0` for Railway)
- Check connection string format

### Redis Connection Issues
- Verify Redis addon is added in Railway
- Check `REDIS_URL` is set (Railway sets this automatically)

### DNS Not Working
- Wait for propagation (up to 48 hours, usually 5-30 minutes)
- Verify records with: `nslookup api.runelabs.dev`

---

## 8. Monitoring

### Railway
- View logs in Railway dashboard
- Set up alerts for deployment failures

### Vercel
- View deployment logs
- Analytics available in dashboard

### Health Endpoint
Set up uptime monitoring (e.g., UptimeRobot) for:
- `https://api.runelabs.dev/health`
- `https://www.runelabs.dev`

---

## 9. Costs (Estimated)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 100GB bandwidth/month | $20/month |
| Railway | $5 free credit/month | ~$5-10/month |
| MongoDB Atlas | M0 (512MB) free | M10 $57/month |
| Redis (Railway) | Included in Railway | - |

For a side project with moderate traffic, you can stay within free tiers.

---

## 10. Environment Variables Summary

### Backend (Railway)
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
REDIS_URL=redis://... (auto-set by Railway)
CORS_ORIGIN=https://www.runelabs.dev,https://runelabs.dev
USE_BALANCE_V2=true
```

### Frontend (Vercel)
```env
VITE_API_URL=https://api.runelabs.dev/api
```

### CLI
```env
EXPENSE_API_URL=https://api.runelabs.dev/api
EXPENSE_CLI_TOKEN=your-jwt-token
```
