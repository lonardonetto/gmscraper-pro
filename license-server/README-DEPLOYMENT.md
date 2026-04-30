# License Server Deployment Guide

## Quick Deploy to Render.com (Free)

### 1. Push to GitHub
```bash
cd E:\gpmscraper
git add .
git commit -m "Add license server deployment files"
git push origin main
```

### 2. Deploy to Render
1. Go to https://render.com
2. Sign up (free)
3. Click "New +" -> "Web Service"
4. Connect your GitHub repository
5. Select the license-server folder
6. Build: `npm install`
7. Start: `node server.js`
8. Environment Variables:
   - `PORT`: 3001
   - `ADMIN_SECRET`: (generate random secret)

### 3. Get your server URL
Render will give you a URL like: `https://gmscraper-license-server.onrender.com`

### 4. Update your app
Edit `.env` in the scraper app:
```
LICENSE_SERVER_URL=https://gmscraper-license-server.onrender.com
```

## Alternative: VPS Deployment

### DigitalOcean ($5/month)
```bash
# On your VPS
sudo apt update
sudo apt install -y nodejs npm git

git clone https://github.com/zqdevelopers/gmscraper-pro.git
cd gmscraper-pro/license-server
npm install

# Create .env file
echo "PORT=3001" > .env
echo "ADMIN_SECRET=your-secure-secret-here" >> .env

# Run with PM2 (for auto-restart)
npm install -g pm2
pm2 start server.js --name license-server
pm2 startup
pm2 save
```

## Test the Server
```bash
curl https://your-server-url.com/api/health
```

## Create License Keys
```bash
# Via API
curl -X POST https://your-server-url.com/api/admin/create-license \
  -H "x-admin-secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"plan": "pro", "maxActivations": 1, "expiresAt": "2025-12-31"}'
```

## Important Notes
- Free services (Render) may have cold starts (slow first response)
- For production, use a paid plan or VPS
- Keep your ADMIN_SECRET secure
- Backup your licenses.db regularly
