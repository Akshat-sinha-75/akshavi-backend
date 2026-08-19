# AWS Lightsail Deployment Guide (Mumbai Region — $3.50 to $5/month)

Follow this step-by-step guide to deploy your Women Safety App backend to **AWS Lightsail** with **zero sleeping (24/7 uptime)** and **unbeatable low costs**.

---

## 📋 Step 1: Create Your AWS Lightsail Instance

1. Log into your [AWS Management Console](https://console.aws.amazon.com/lightsail/).
2. Open **AWS Lightsail**.
3. Select **Create Instance**.
4. Choose Instance Location:
   * **Region:** `Asia Pacific (Mumbai) (ap-south-1)` *(Critical for low latency in India)*.
5. Select Platform & Blueprint:
   * **Platform:** `Linux/Unix`
   * **Blueprint:** `OS Only` -> `Ubuntu 22.04 LTS` (or `Debian 12`)
6. Choose Instance Plan:
   * **$3.50/month** (512MB RAM, 1 vCPU, 20GB SSD, 1 TB Free Egress Transfer) OR
   * **$5.00/month** (1GB RAM, 1 vCPU, 40GB SSD, 2 TB Free Egress Transfer) — **Recommended for TimescaleDB**.
7. Name your instance (e.g., `women-safety-backend`) and click **Create Instance**.

---

## 🔒 Step 2: Attach Static IP & Configure Firewall

1. Go to the **Networking** tab in Lightsail.
2. Click **Create Static IP** and attach it to `women-safety-backend`. *(This ensures your server IP never changes when rebooted — completely FREE on Lightsail!)*.
3. Under **IPv4 Firewall**, open the following ports:
   * `HTTP` (Port 80)
   * `HTTPS` (Port 443)
   * `Custom TCP` (Port 8080)
   * `SSH` (Port 22)

---

## 💻 Step 3: Connect via SSH & Install Docker

1. Click **Connect using SSH** in the Lightsail Web Console (or use your local terminal `ssh ubuntu@YOUR_STATIC_IP`).
2. Update system packages and install Docker:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-plugin git

# Enable Docker on startup
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## 🚀 Step 4: Deploy Your App with Docker Compose

1. Clone or copy your code repository to the Lightsail server:

```bash
git clone <YOUR_GIT_REPO_URL> app
cd app
```

2. Create your environment file `.env`:

```bash
cp .env.example .env
nano .env
# Set strong passwords for DB_PASSWORD and your FCM key
```

3. Launch the full application stack in background mode:

```bash
docker compose up -d --build
```

4. Verify all containers are running and healthy:

```bash
docker compose ps
docker compose logs -f backend
```

5. Test the health check endpoint from your browser or terminal:

```bash
curl http://YOUR_STATIC_IP:8080/health
```

Expected Output:
```json
{
  "status": "ok",
  "timestamp": "2026-08-18T22:35:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

## 🌐 Step 5: Connect Cloudflare (Free SSL & DDoS Protection)

1. Add your custom domain (e.g., `api.womensafety.app`) to **Cloudflare Free Tier**.
2. Create an **A Record** pointing `api.womensafety.app` to your **AWS Lightsail Static IP**.
3. Enable Cloudflare **Proxied Mode (Orange Cloud)** for instant DDoS protection and free SSL certificates.

---

### 🎉 Result
Your Women Safety Backend is now live on AWS in **Mumbai**, running **24/7 with zero cold-starts**, sub-second response times for emergency alerts, and a fixed cost of **$3.50 to $5.00/month**!
