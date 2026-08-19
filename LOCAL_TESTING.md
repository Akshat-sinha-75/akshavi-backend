# Women Safety Platform — Local Testing & Verification Guide

This guide walks you through starting and verifying the complete Women Safety platform locally on your machine in under **2 minutes**.

---

## ⚡ Prerequisites
* **Docker Desktop** installed on Windows/Mac/Linux.

---

## 🚀 Step 1: Start the Entire Application Stack

In your project directory (`d:\Copied\Akshavi`), open PowerShell / Terminal and run:

```powershell
docker compose up -d --build
```

This single command starts:
1. **TimescaleDB** (PostgreSQL 16 with PostGIS extension pre-loaded with initial seed schema).
2. **Redis 7** (In-memory emergency state cache).
3. **Go Backend Server** (REST APIs + WebSocket hub + Web UI on port `8080`).

---

## 🌐 Step 2: Open the Interactive Web Application

Open your browser and visit:

👉 **[http://localhost:8080](http://localhost:8080)**

You will see the dual-interface platform:
* **Left Screen:** The **Protected User Mobile App** (SOS button, Track Me switch, Fake PIN duress dialer, Trust Groups).
* **Right Screen:** The **Guardian / Trustee Live Map Dashboard** (Real-time GPS tracking, emergency siren, telemetry badges, activity log).

---

## 🧪 Step 3: Interactive Tests to Try

### 1. Test Real-Time Location Streaming ("TRACK ME")
1. Click **"Simulate Walking"** on the toolbar below the map.
2. Watch the marker move along the street in Mumbai with a live movement trail.
3. Observe the speed (`5.0 km/h`), coordinates, and TimescaleDB ingest latency updating in real-time via WebSockets.

### 2. Test 1-Tap SOS Emergency Broadcast
1. On the mobile screen on the left, tap the big red **"SOS"** button.
2. Observe the immediate sub-second changes:
   * Siren sound begins playing.
   * Emergency flashing red banner appears on the Trustee dashboard.
   * Telemetry automatically switches to high-priority 1-second interval.
3. Click **"Resolve SOS"** and enter the Real PIN (`1234`) to confirm safety and deactivate the alarm.

### 3. Test the "Fake PIN" Silent Duress Alert
1. Click the **"Fake PIN"** tab or key icon on the mobile phone screen.
2. Enter the Fake PIN: `9999` and press `✓`.
3. The app simulates a standard normal login to protect the victim, but **silently broadcasts an emergency alert to all guardians in the background!**

---

## 🤖 Step 4: Run Automated API Tests

To execute the automated end-to-end integration test suite, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test_api.ps1
```

The script will automatically test:
* `/health` (Database & Redis health status)
* `/api/auth/login` (Standard PIN vs Fake PIN detection)
* `/api/location/track` (TimescaleDB hypertable ingestion)
* `/api/sos/trigger` (Emergency broadcast engine)
* `/api/sos/resolve` (PIN verification & resolution)

---

## 🛑 How to Stop the Local Stack

When you are done testing, run:

```powershell
docker compose down
```
