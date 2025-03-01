# 10HourLoop Backend Server

This is the backend server for 10HourLoop.com, a service that creates extended duration loops of audio and video files.

## Prerequisites

- Node.js (v14 or later)
- FFmpeg
- Digital Ocean Spaces account (for file storage)

## Local Development Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your Digital Ocean Spaces credentials
4. Start the development server:
   ```
   npm run dev
   ```

## Production Deployment

### Setup Digital Ocean Spaces

1. Create a Space in your Digital Ocean account
2. Create API keys from the "API" section in your Digital Ocean dashboard
3. Update your `.env` file with your Spaces credentials

### Deploy to Digital Ocean Droplet

1. Transfer the server files to your Droplet
2. SSH into your Droplet
3. Navigate to the server directory
4. Make the deployment script executable:
   ```
   chmod +x deploy.sh
   ```
5. Run the deployment script:
   ```
   ./deploy.sh
   ```

## Setting Up Nginx (Optional but Recommended)

For production use, it's recommended to set up Nginx as a reverse proxy:

1. Install Nginx:
   ```
   apt update
   apt install nginx
   ```

2. Create a configuration file:
   ```
   nano /etc/nginx/sites-available/10hourloop
   ```

3. Add the following configuration:
   ```
   server {
       listen 80;
       server_name your-domain-or-ip;

       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location / {
           root /var/www/10hourloop;  # Frontend files location
           try_files $file $file/ /index.html;
       }
   }
   ```

4. Enable the site:
   ```
   ln -s /etc/nginx/sites-available/10hourloop /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

## API Endpoints

- `POST /api/upload` - Upload a file
- `POST /api/process` - Process a file to create a loop
- `GET /api/status/:jobId` - Check processing status
- `GET /api/download/:filename` - Download a processed file

## Troubleshooting

- Check server logs: `pm2 logs 10hourloop-api`
- Check Nginx logs: `tail -f /var/log/nginx/error.log`
- Restart services: `pm2 restart 10hourloop-api && systemctl restart nginx`