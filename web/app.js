// State Management
const STATE = {
  userId: 'a0000000-0000-0000-0000-000000000001',
  userName: 'Priya Sharma',
  userPhone: '+919876543210',
  currentLat: 19.0760,
  currentLng: 72.8777,
  batteryLevel: 85,
  speedMPS: 0.0,
  isTracking: true,
  isSOSActive: false,
  activeSOSEventId: null,
  ws: null,
  map: null,
  userMarker: null,
  accuracyCircle: null,
  pathPolyline: null,
  pathHistory: [],
  simInterval: null,
  audioCtx: null,
  sirenOsc: null,
  enteredPin: ''
};

// Mumbai Route Waypoints for Realistic Movement Simulation
const SIM_ROUTE = [
  { lat: 19.0760, lng: 72.8777 },
  { lat: 19.0768, lng: 72.8785 },
  { lat: 19.0775, lng: 72.8792 },
  { lat: 19.0782, lng: 72.8801 },
  { lat: 19.0790, lng: 72.8812 },
  { lat: 19.0801, lng: 72.8825 },
  { lat: 19.0815, lng: 72.8840 },
  { lat: 19.0805, lng: 72.8855 },
  { lat: 19.0792, lng: 72.8848 },
  { lat: 19.0778, lng: 72.8830 }
];
let currentRouteIndex = 0;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initMap();
  connectWebSocket();
  checkInitialActiveSOS();
});

// Clock in Phone Screen
function initClock() {
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const el = document.getElementById('phoneTime');
    if (el) el.textContent = `${hours}:${mins}`;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Leaflet Map Initialization
function initMap() {
  STATE.map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView([STATE.currentLat, STATE.currentLng], 16);

  // CartoDB Dark Matter Tiles for high-tech aesthetic
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(STATE.map);

  // Custom User Icon
  const userIcon = L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      width: 22px; height: 22px;
      background: #ec4899;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(236,72,153,0.8);
      position: relative;
    "><div style="
      position: absolute; width: 36px; height: 36px;
      border: 2px solid #ec4899;
      border-radius: 50%;
      top: -10px; left: -10px;
      animation: pulse-ring 1.8s infinite;
    "></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  STATE.userMarker = L.marker([STATE.currentLat, STATE.currentLng], { icon: userIcon }).addTo(STATE.map);
  STATE.userMarker.bindPopup(`<b>${STATE.userName}</b><br>Live Protection Active`).openPopup();

  // Accuracy Circle
  STATE.accuracyCircle = L.circle([STATE.currentLat, STATE.currentLng], {
    radius: 20,
    color: '#ec4899',
    fillColor: '#ec4899',
    fillOpacity: 0.15,
    weight: 1
  }).addTo(STATE.map);

  // Movement Trail Polyline
  STATE.pathPolyline = L.polyline([[STATE.currentLat, STATE.currentLng]], {
    color: '#ec4899',
    weight: 4,
    opacity: 0.8,
    dashArray: '6, 8'
  }).addTo(STATE.map);
}

// Real-Time WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  STATE.ws = new WebSocket(wsUrl);

  STATE.ws.onopen = () => {
    logEvent('system', '🔌 Connected to Real-Time Telemetry Stream.');
    document.getElementById('wsStatusText').textContent = 'Connected (Sub-second Stream)';
    document.getElementById('wsStatusIndicator').classList.remove('offline');
    document.getElementById('wsStatusIndicator').classList.add('online');
  };

  STATE.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (e) {
      console.error('WS Parse Error', e);
    }
  };

  STATE.ws.onclose = () => {
    document.getElementById('wsStatusText').textContent = 'Reconnecting...';
    document.getElementById('wsStatusIndicator').classList.remove('online');
    document.getElementById('wsStatusIndicator').classList.add('offline');
    setTimeout(connectWebSocket, 3000);
  };
}

// Handle Incoming WebSocket Messages
function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'LOCATION_UPDATE':
      onLocationReceived(msg.payload);
      break;

    case 'SOS_TRIGGERED':
      onSOSTriggered(msg.payload);
      break;

    case 'SOS_RESOLVED':
      onSOSResolved(msg.payload);
      break;
  }
}

// Location Update Event Handler
function onLocationReceived(lp) {
  STATE.currentLat = lp.latitude;
  STATE.currentLng = lp.longitude;
  STATE.speedMPS = lp.speedMPS || 0;
  STATE.batteryLevel = lp.batteryLevel;

  // Update Map Marker
  const newLatLng = [lp.latitude, lp.longitude];
  STATE.userMarker.setLatLng(newLatLng);
  STATE.accuracyCircle.setLatLng(newLatLng);

  // Append Trail
  STATE.pathHistory.push(newLatLng);
  if (STATE.pathHistory.length > 50) STATE.pathHistory.shift();
  STATE.pathPolyline.setLatLngs(STATE.pathHistory);

  // Smooth Pan
  STATE.map.panTo(newLatLng, { animate: true, duration: 0.5 });

  // Update Badges
  document.getElementById('coordsBadge').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${lp.latitude.toFixed(4)}, ${lp.longitude.toFixed(4)}`;
  document.getElementById('speedBadge').innerHTML = `<i class="fa-solid fa-gauge-high"></i> ${(lp.speedMPS * 3.6).toFixed(1)} km/h`;
  document.getElementById('phoneBatteryText').innerHTML = `<i class="fa-solid fa-battery-three-quarters"></i> ${lp.batteryLevel}%`;

  logEvent('location', `📍 Coordinates ingested in TimescaleDB: ${lp.latitude.toFixed(5)}, ${lp.longitude.toFixed(5)} (${(lp.speedMPS * 3.6).toFixed(1)} km/h)`);
}

// SOS Triggered Handler
function onSOSTriggered(sosEvt) {
  STATE.isSOSActive = true;
  STATE.activeSOSEventId = sosEvt.id;

  // UI Updates
  document.getElementById('emergencyBanner').style.display = 'flex';
  document.getElementById('sosBtn').classList.add('active-sos');
  document.getElementById('sosAlertMessage').textContent = `🚨 ${STATE.userName} triggered ${sosEvt.triggerType} Emergency! Coordinates sent to family & Police dispatch.`;
  document.getElementById('sosHelperText').textContent = '⚠️ EMERGENCY ACTIVE! Broadcasting to trustees.';
  document.getElementById('sosHelperText').style.color = '#ef4444';

  // Sound Siren
  startSirenSound();

  // Log Event
  logEvent('sos', `🚨 CRITICAL EMERGENCY SOS: Triggered via ${sosEvt.triggerType} at (${sosEvt.initialLatitude}, ${sosEvt.initialLongitude})`);
}

// SOS Resolved Handler
function onSOSResolved(payload) {
  STATE.isSOSActive = false;
  STATE.activeSOSEventId = null;

  // UI Updates
  document.getElementById('emergencyBanner').style.display = 'none';
  document.getElementById('sosBtn').classList.remove('active-sos');
  document.getElementById('sosHelperText').textContent = 'Press once to notify family & start 1-sec live tracking';
  document.getElementById('sosHelperText').style.color = 'var(--text-secondary)';

  stopSirenSound();
  logEvent('system', `✅ SOS Emergency successfully deactivated and marked SAFE in TimescaleDB.`);
}

// User Actions: Big SOS Button Click
async function handleSOSClick() {
  if (STATE.isSOSActive) {
    openResolveModal();
    return;
  }

  try {
    const res = await fetch('/api/sos/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: STATE.userId,
        triggerType: 'ONE_TAP',
        latitude: STATE.currentLat,
        longitude: STATE.currentLng,
        batteryLevel: STATE.batteryLevel
      })
    });
    const data = await res.json();
    if (res.ok) {
      STATE.activeSOSEventId = data.sosEvent.id;
    }
  } catch (err) {
    console.error('Error triggering SOS:', err);
  }
}

// Voice Trigger Simulation
function simulateVoiceTrigger() {
  fetch('/api/sos/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: STATE.userId,
      triggerType: 'VOICE_COMMAND',
      latitude: STATE.currentLat,
      longitude: STATE.currentLng,
      batteryLevel: STATE.batteryLevel
    })
  });
}

// Track Me Toggle
function toggleTrackMe() {
  const toggle = document.getElementById('trackMeToggle');
  STATE.isTracking = toggle.checked;
  document.getElementById('trackingStatusSubtitle').textContent = STATE.isTracking ? 'Live sharing with 2 Trustees' : 'Location sharing paused';
  logEvent('system', `ℹ️ TRACK ME live location sharing ${STATE.isTracking ? 'ENABLED' : 'PAUSED'}.`);
}

// Fake PIN / Duress Logic
function openFakePinModal() {
  STATE.enteredPin = '';
  document.getElementById('pinDisplay').textContent = '____';
  document.getElementById('fakePinModal').classList.add('show');
}

function closeFakePinModal() {
  document.getElementById('fakePinModal').classList.remove('show');
}

function pressKey(num) {
  if (STATE.enteredPin.length < 4) {
    STATE.enteredPin += num;
    document.getElementById('pinDisplay').textContent = '*'.repeat(STATE.enteredPin.length).padEnd(4, '_');
  }
}

function clearKey() {
  STATE.enteredPin = '';
  document.getElementById('pinDisplay').textContent = '____';
}

async function submitPin() {
  if (STATE.enteredPin.length !== 4) return;

  const pin = STATE.enteredPin;
  closeFakePinModal();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: STATE.userPhone,
        pin: pin
      })
    });
    const data = await res.json();

    if (data.isFakeLogin) {
      logEvent('sos', `🚨 DURESS TRIGGERED: Silent SOS dispatched via Fake PIN (9999) without attacker detection!`);
    } else {
      logEvent('system', `🔓 Normal login verified with real PIN.`);
    }
  } catch (err) {
    console.error('PIN submit error', err);
  }
}

// Resolve Modal Logic
function openResolveModal() {
  document.getElementById('resolvePinInput').value = '';
  document.getElementById('resolveModal').classList.add('show');
}

function closeResolveModal() {
  document.getElementById('resolveModal').classList.remove('show');
}

async function submitResolveSOS() {
  const pin = document.getElementById('resolvePinInput').value;
  if (!pin) return;

  try {
    const res = await fetch('/api/sos/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sosEventId: STATE.activeSOSEventId || 'dummy',
        userId: STATE.userId,
        pin: pin
      })
    });

    if (res.ok) {
      closeResolveModal();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to resolve SOS');
    }
  } catch (e) {
    console.error(e);
  }
}

// Movement Simulation Engine
function startMovementSimulation(mode) {
  stopSimulation();
  const speed = mode === 'walk' ? 1.4 : 8.5; // m/s
  const intervalMs = STATE.isSOSActive ? 1000 : 2500;

  logEvent('system', `🏃 Started ${mode.toUpperCase()} simulation route along Mumbai coordinates.`);

  STATE.simInterval = setInterval(() => {
    currentRouteIndex = (currentRouteIndex + 1) % SIM_ROUTE.length;
    const target = SIM_ROUTE[currentRouteIndex];

    // Jitter coordinates slightly for realism
    const lat = target.lat + (Math.random() - 0.5) * 0.0003;
    const lng = target.lng + (Math.random() - 0.5) * 0.0003;

    // Send to Backend API
    fetch('/api/location/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: STATE.userId,
        latitude: lat,
        longitude: lng,
        accuracyMeters: 3.5,
        batteryLevel: Math.max(20, STATE.batteryLevel - (Math.random() > 0.8 ? 1 : 0)),
        speedMPS: speed
      })
    });
  }, intervalMs);
}

function stopSimulation() {
  if (STATE.simInterval) {
    clearInterval(STATE.simInterval);
    STATE.simInterval = null;
    logEvent('system', '⏸️ Movement simulation paused.');
  }
}

// Real Browser GPS Integration
function useBrowserGPS() {
  if (!navigator.geolocation) {
    alert('Geolocation not supported by browser.');
    return;
  }

  stopSimulation();
  logEvent('system', '🛰️ Requesting device GPS coordinates...');

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = pos.coords.speed || 0.0;

    fetch('/api/location/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: STATE.userId,
        latitude: lat,
        longitude: lng,
        accuracyMeters: pos.coords.accuracy || 5.0,
        batteryLevel: 85,
        speedMPS: speed
      })
    });
  }, (err) => {
    alert(`GPS Error: ${err.message}`);
  }, { enableHighAccuracy: true });
}

// Check if any SOS is already active on load
async function checkInitialActiveSOS() {
  try {
    const res = await fetch('/api/sos/active');
    const events = await res.json();
    if (events && events.length > 0) {
      onSOSTriggered(events[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

// Web Audio API Siren Alarm Generator
function startSirenSound() {
  try {
    if (!STATE.audioCtx) {
      STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (STATE.audioCtx.state === 'suspended') {
      STATE.audioCtx.resume();
    }

    if (STATE.sirenOsc) return;

    const osc = STATE.audioCtx.createOscillator();
    const gain = STATE.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, STATE.audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(950, STATE.audioCtx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.08, STATE.audioCtx.currentTime); // pleasant audible volume

    osc.connect(gain);
    gain.connect(STATE.audioCtx.destination);
    osc.start();

    STATE.sirenOsc = osc;
  } catch (e) {
    console.log('Audio autoplay prevented by browser interaction policy', e);
  }
}

function stopSirenSound() {
  if (STATE.sirenOsc) {
    try {
      STATE.sirenOsc.stop();
      STATE.sirenOsc.disconnect();
    } catch (e) {}
    STATE.sirenOsc = null;
  }
}

// Event Feed Logger
function logEvent(type, text) {
  const feed = document.getElementById('eventFeed');
  if (!feed) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const item = document.createElement('div');
  item.className = `feed-item ${type === 'sos' ? 'sos' : ''}`;
  item.innerHTML = `
    <span class="feed-time">${timeStr}</span>
    <span class="feed-text">${text}</span>
  `;

  feed.prepend(item);
  if (feed.children.length > 30) feed.removeChild(feed.lastChild);
}
