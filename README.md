# Akshavi - Women Safety Application Platform

## What It Is

Akshavi is a comprehensive, full-stack platform specifically designed to empower and enhance women's safety in real-time.
It seamlessly integrates a cross-platform mobile application, a scalable Go backend, and an administrative web dashboard.
The system delivers continuous protection through intelligent background tracking, one-tap SOS alerts, and a fake PIN duress alarm.
By utilizing a secure trustee pairing system, it ensures that trusted guardians are instantly notified during any critical situation.

## What It Does

The core functionalities of the platform include:

- **1-Tap Emergency SOS:** Instantly triggers an emergency alert, broadcasting the user's live location to trusted contacts and the admin dashboard.
- **Intelligent Real-Time Tracking ("Track Me"):** Provides continuous background location tracking (optimized for battery and data efficiency by compressing movement data).
- **Fake PIN Duress Alarm:** A unique security feature that safely unlocks the phone to an attacker while silently broadcasting a hidden emergency alert to family members in the background.
- **Trustee Pairing System:** Allows users to pair with "guardians" (family or friends) and manage granular permissions for live GPS sharing.
- **Admin Monitoring Dashboard:** A centralized web portal for super-admins to monitor active SOS events, view user profiles, and analyze real-time emergency trails.

## Tech Stack Used

The project is structured as a full-stack monorepo, leveraging a modern and scalable tech stack:

### ⚙️ Backend & API
- **Language:** Go (Golang 1.22)
- **WebSockets:** Gorilla WebSocket (`gorilla/websocket`) for real-time, bi-directional communication of location trails and SOS alerts.
- **Architecture:** Standard `net/http` router with RESTful principles.

### 📱 Mobile Application (Client)
- **Framework:** React Native + Expo
- **Language:** TypeScript
- **Mapping:** React Native Maps (`react-native-maps`)
- **Icons & UI:** Lucide React Native (`lucide-react-native`)

### 🌐 Web Admin Dashboard
- **Tech:** HTML5, CSS3, Vanilla JavaScript
- **Delivery:** Served statically via the Go backend.

### 🗄️ Database & Caching
- **Primary Database:** PostgreSQL
- **Time-Series Data:** TimescaleDB extension for PostgreSQL (highly optimized for storing and querying continuous location history).
- **Caching & Sessions:** Redis (using `redis/go-redis/v9`) for fast state management and temporary storage.

### 🐳 Infrastructure & Deployment
- **Containerization:** Docker & Docker Compose for orchestrating reproducible development and production environments.

## Getting Started

To spin up the entire backend stack locally using Docker:

```bash
docker-compose up --build
```
This will start the Go backend (Port `8080`), PostgreSQL + TimescaleDB (mapped to Port `5433`), and Redis (mapped to Port `6380`).

To start the mobile application:
```bash
cd mobile
npm install
npm start # or npx expo start
```
