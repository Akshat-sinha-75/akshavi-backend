# Akshavi — React Native Mobile Application (iOS & Android)

This is the native cross-platform mobile application for **Akshavi Women Safety**, built with **React Native + Expo + TypeScript**.

---

## 📱 Features Included
* **1-Tap Emergency SOS:** Triggers priority GPS broadcast with haptic feedback.
* **Intelligent TRACK ME:** Background location tracking with 20-meter movement compression (saves 80% data & battery).
* **Fake PIN Duress Alarm:** Unlocks phone safely while silently broadcasting an emergency alert to family in the background.
* **Trust Group Contacts:** Real-time sync with guardian contacts.
* **AWS Lightsail Integration:** Directly connects to your Go backend and TimescaleDB server.

---

## 🚀 How to Run on Real Phone (iOS & Android)

### Step 1: Install Dependencies
Inside the `mobile/` directory:

```bash
cd mobile
npm install
```

### Step 2: Configure API Endpoint
Open `src/services/api.ts` and set your backend IP:
* For local testing on emulator: `http://localhost:8080` (or `http://10.0.2.2:8080` on Android Emulator)
* For real phone on same Wi-Fi: `http://YOUR_COMPUTER_LOCAL_IP:8080` (e.g. `http://192.168.1.15:8080`)
* For production on AWS Lightsail: `http://YOUR_LIGHTSAIL_STATIC_IP:8080` or `https://api.yourdomain.com`

### Step 3: Start the App
```bash
npx expo start
```

### Step 4: Open on Your Device
1. Install **Expo Go** from Google Play Store or Apple App Store.
2. Scan the QR code displayed in your terminal.
3. The full native mobile app will open on your phone!
