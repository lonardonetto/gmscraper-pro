#!/bin/bash

# DigitalOcean License Server Setup Script
# Run this on your DigitalOcean droplet

echo "Setting up GMScraper License Server on DigitalOcean..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install git
sudo apt install -y git

# Clone the repository
cd /opt
sudo git clone https://github.com/zqdevelopers/gmscraper-pro.git
sudo chown -R $USER:$USER /opt/gmscraper-pro

# Navigate to license server
cd /opt/gmscraper-pro/license-server

# Install dependencies
npm install

# Create .env file
echo "PORT=3001" > .env
echo "ADMIN_SECRET=$(openssl rand -base64 32)" >> .env

# Create database
node seed-license.js

# Start server with PM2
pm2 start server.js --name license-server

# Setup PM2 to start on boot
pm2 startup
pm2 save

# Setup firewall
sudo ufw allow 22
sudo ufw allow 3001
sudo ufw --force enable

# Show server status
echo "==================================="
echo "License Server Setup Complete!"
echo "==================================="
echo "Server IP: $(curl -s ifconfig.me)"
echo "Server URL: http://$(curl -s ifconfig.me):3001"
echo "Admin Secret: $(grep ADMIN_SECRET .env | cut -d'=' -f2)"
echo ""
echo "Test with: curl http://$(curl -s ifconfig.me):3001/api/health"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs license-server - View logs"
echo "  pm2 restart license-server - Restart server"
echo "==================================="
