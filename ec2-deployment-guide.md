# Deploying Akshavi Backend to AWS EC2

This guide walks you through deploying your Golang/TimescaleDB/Redis backend stack to an AWS EC2 instance using Docker Compose and an Elastic IP.

## 1. Launch EC2 Instance

1. Log into your AWS Console and go to **EC2 > Instances > Launch instances**.
2. **Name**: `akshavi-backend`
3. **OS Image**: Select **Ubuntu 22.04 LTS** (or Amazon Linux 2023).
4. **Instance Type**: 
   - `t3.micro` (Free tier eligible, good for testing)
   - `t3.small` or `t3.medium` (Recommended for production with TimescaleDB)
5. **Key Pair**: Create a new key pair (e.g., `akshavi-key.pem`) and download it. Keep it safe.
6. **Network Settings**:
   - Auto-assign Public IP: **Enable**
   - Create a new Security Group.
   > **Note:** If you see a warning that your account has no VPCs in this region, click the **"create a new default VPC"** link in the warning message before proceeding.
7. **Storage**: Allocate at least **20 GB gp3** (Docker, DB, and Redis will need space).
8. Click **Launch instance**.

## 2. Configure Security Group (Firewall Rules)

Go to **Security Groups** in the EC2 dashboard, find the one attached to your instance, and edit the **Inbound Rules**:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP only (or 0.0.0.0/0) | SSH access |
| 80 | TCP | 0.0.0.0/0 (Anywhere) | HTTP traffic (optional, for future SSL redirect) |
| 443 | TCP | 0.0.0.0/0 (Anywhere) | HTTPS traffic (optional, for future domain/SSL) |
| 8080 | TCP | 0.0.0.0/0 (Anywhere) | **Go backend direct access** |

> **Warning:** Do **NOT** open ports `5432` or `6379` to the internet. The backend container communicates with PostgreSQL and Redis over the internal Docker network.

## 3. Setup Elastic IP

To ensure your IP address doesn't change when the server restarts:
1. Go to **EC2 > Elastic IPs**.
2. Click **Allocate Elastic IP address**.
3. Select the new IP, click **Actions > Associate Elastic IP address**.
4. Choose your `akshavi-backend` instance and click **Associate**.
5. Note this Elastic IP down (e.g., `203.0.113.45`).

## 4. Server Setup & Deployment

SSH into your server using your terminal (replace `<your-elastic-ip>`):

```bash
# Modify key permissions (Mac/Linux only)
chmod 400 akshavi-key.pem

# SSH into the server
ssh -i "akshavi-key.pem" ubuntu@<your-elastic-ip>
```

### Install Docker & Git

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker, Compose, and Git
sudo apt install -y docker.io docker-compose-v2 git

# Enable Docker on boot and start it
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to the docker group (avoids needing sudo)
sudo usermod -aG docker $USER
```
> **Note:** Run `newgrp docker` or log out and log back in for the group change to take effect.

### Clone Code & Configure

```bash
# Clone your repository (use a Personal Access Token if private)
git clone <your-github-repo-url> ~/akshavi
cd ~/akshavi

# Copy environment variables
cp .env.example .env
nano .env
```
Inside `.env`, make sure to change the default passwords:
```env
DB_PASSWORD=your_super_strong_password
FCM_SERVER_KEY=your_firebase_server_key
```

### Build & Run

```bash
# Build the images and start containers in detached mode
docker compose up -d --build
```

### Verify Deployment

Check if the containers are running:
```bash
docker compose ps
```

Check the backend logs:
```bash
docker compose logs -f backend
```

Ping the health endpoint from your local browser or terminal:
```bash
curl http://<your-elastic-ip>:8080/health
```
You should see a JSON response confirming `status: "ok"`.

## 5. Update Mobile App

Now that your backend is running on EC2, you need to update the mobile app to talk to it.

1. Open `mobile/src/services/api.ts`
2. Change the `getDefaultApiUrl()` function:
```typescript
function getDefaultApiUrl(): string {
  return 'http://<your-elastic-ip>:8080';
}
```
3. Rebuild your Expo app.

> **Tip:** If you are testing via Expo Go, make sure your phone is connected to the internet. The backend is now live on the public web, so local network rules don't apply anymore.

## 6. Maintenance & Troubleshooting

**Restarting the backend:**
```bash
cd ~/akshavi
docker compose restart backend
```

**Applying new code updates:**
```bash
cd ~/akshavi
git pull origin main
docker compose up -d --build backend
```

**Docker Auto-Restart:**
Your `docker-compose.yml` already has `restart: always` set for all services. If the EC2 instance reboots, Docker will automatically spin up the database, redis, and your backend app.
