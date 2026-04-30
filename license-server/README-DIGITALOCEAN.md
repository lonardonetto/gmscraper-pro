# DigitalOcean License Server Setup

## Quick Setup (5 minutes)

### 1. Create DigitalOcean Droplet
1. Log in to https://cloud.digitalocean.com
2. Click **"Create"** -> **"Droplets"**
3. Choose distribution: **Ubuntu 22.04 LTS**
4. Choose plan: **Basic** ($5/month - 1 CPU, 1GB RAM, 25GB SSD)
5. Choose region: Closest to your clients
6. Authentication: **SSH Key** (recommended) or Password
7. Hostname: `gmscraper-license-server`
8. Click **"Create Droplet"**

### 2. Connect to Your Droplet
```bash
# Using SSH (replace with your IP)
ssh root@YOUR_DROPLET_IP

# Or use DigitalOcean web console
```

### 3. Run Setup Script
```bash
# Copy and paste this command:
curl -s https://raw.githubusercontent.com/zqdevelopers/gmscraper-pro/main/license-server/digitalocean-setup.sh | bash
```

### 4. Your Server is Ready!
After the script finishes, you'll see:
```
Server IP: 123.45.67.89
Server URL: http://123.45.67.89:3001
Admin Secret: abc123def456...
```

## Manual Setup (if script fails)

### Step 1: Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Install PM2
```bash
sudo npm install -g pm2
```

### Step 4: Clone Repository
```bash
cd /opt
sudo git clone https://github.com/zqdevelopers/gmscraper-pro.git
sudo chown -R $USER:$USER /opt/gmscraper-pro
```

### Step 5: Setup License Server
```bash
cd /opt/gmscraper-pro/license-server
npm install
echo "PORT=3001" > .env
echo "ADMIN_SECRET=$(openssl rand -base64 32)" >> .env
node seed-license.js
```

### Step 6: Start Server
```bash
pm2 start server.js --name license-server
pm2 startup
pm2 save
```

### Step 7: Configure Firewall
```bash
sudo ufw allow 22
sudo ufw allow 3001
sudo ufw --force enable
```

## Test Your Server

### Check Health
```bash
curl http://YOUR_IP:3001/api/health
```

### Create License Key
```bash
# Get your admin secret from .env
grep ADMIN_SECRET .env

# Create a license
curl -X POST http://YOUR_IP:3001/api/admin/create-license \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"plan": "pro", "maxActivations": 1, "expiresAt": "2025-12-31"}'
```

## Update Your Scraper App

1. Edit `.env` in your scraper app:
   ```
   LICENSE_SERVER_URL=http://YOUR_IP:3001
   ```

2. Rebuild the .exe with the new server URL

## Server Management

### Useful Commands
```bash
pm2 status              # Check server status
pm2 logs license-server # View logs
pm2 restart license-server # Restart server
pm2 stop license-server  # Stop server
pm2 delete license-server # Remove from PM2
```

### Update Server
```bash
cd /opt/gmscraper-pro/license-server
git pull
npm install
pm2 restart license-server
```

### Backup Database
```bash
cp /opt/gmscraper-pro/license-server/licenses.db /opt/licenses-backup-$(date +%Y%m%d).db
```

## Security Tips

1. **Change the default admin secret**:
   ```bash
   nano .env
   # Edit ADMIN_SECRET value
   pm2 restart license-server
   ```

2. **Use HTTPS** (optional):
   Install Nginx and SSL certificate for production

3. **Monitor server**:
   ```bash
   pm2 monit
   ```

## Troubleshooting

### Server not accessible?
```bash
# Check if server is running
pm2 status

# Check if port is open
sudo ufw status

# Check logs
pm2 logs license-server
```

### Database issues?
```bash
# Recreate database
cd /opt/gmscraper-pro/license-server
rm licenses.db
node seed-license.js
pm2 restart license-server
```

## Cost
- **Droplet**: $5/month
- **Bandwidth**: Free (1TB/month)
- **Total**: ~$5/month + tax

That's it! Your license server is now live and accessible from anywhere.
