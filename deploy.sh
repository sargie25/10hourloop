#!/bin/bash

# Stop on errors
set -e

echo "10HourLoop.com - Deployment Script"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found!"
  echo "Please create a .env file with your Digital Ocean Spaces credentials."
  echo "You can copy .env.example and fill in your details."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2 globally..."
  npm install -g pm2
fi

# Stop any existing PM2 process
pm2 stop 10hourloop-api 2>/dev/null || true

# Start the server with PM2
echo "Starting server with PM2..."
pm2 start index.js --name "10hourloop-api"
pm2 save

echo "Setting up PM2 to start on system boot..."
pm2 startup | tail -n 1

echo "Deployment complete!"
echo "Your 10HourLoop API is now running with PM2."
echo "To check status: pm2 status"
echo "To view logs: pm2 logs 10hourloop-api"