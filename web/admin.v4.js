let allUsers = [];
let adminMap = null;
let adminMarker = null;
let adminTrail = null;
let inspectedUserId = null;

const ADMIN_TOKEN_KEY = 'raksha_admin_auth_token';

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    document.getElementById('loginOverlay').style.display = 'none';
    initAdminDashboard();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
});

async function handleAdminLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorMsg = document.getElementById('loginErrorMsg');
  const btn = document.getElementById('loginBtn');

  if (!email || !password) {
    errorMsg.textContent = 'Please enter email and password.';
    errorMsg.style.display = 'block';
    return;
  }

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      if (data.admin && data.admin.name) {
        document.getElementById('adminHeaderName').textContent = data.admin.name;
      }
      document.getElementById('loginOverlay').style.display = 'none';
      errorMsg.style.display = 'none';
      initAdminDashboard();
    } else {
      const err = await res.json();
      errorMsg.textContent = err.error || 'Invalid credentials. Access Denied.';
      errorMsg.style.display = 'block';
    }
  } catch (e) {
    errorMsg.textContent = 'Server connection error. Please try again.';
    errorMsg.style.display = 'block';
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Sign In to Portal';
    btn.disabled = false;
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  document.getElementById('loginOverlay').style.display = 'flex';
}

function getAuthHeaders() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function initAdminDashboard() {
  loadAdminStats();
  loadAdminUsers();
  connectAdminWebSocket();
  setInterval(loadAdminStats, 5000);
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('statTotalUsers').textContent = stats.totalUsers || 0;
      document.getElementById('statTracking').textContent = stats.trackingActiveCount || 0;
      document.getElementById('statSOS').textContent = stats.activeSosCount || 0;

      const emergencyBar = document.getElementById('adminEmergencyBar');
      if (stats.activeSosCount > 0) {
        emergencyBar.style.display = 'flex';
      } else {
        emergencyBar.style.display = 'none';
      }
    } else if (res.status === 401) {
      handleAdminLogout();
    }
  } catch (e) {
    console.warn('Failed to load stats', e);
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    if (res.ok) {
      allUsers = await res.json();
      renderUserTable(allUsers);
    } else if (res.status === 401) {
      handleAdminLogout();
    }
  } catch (e) {
    console.error('Failed to load admin users', e);
  }
}

function renderUserTable(users) {
  const tbody = document.getElementById('userTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: #64748b;">No users registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(item => {
    const u = item.user;
    const isSOS = item.activeSos !== null && item.activeSos !== undefined;
    const isTracking = u.isTrackingActive;

    let statusPill = '<span class="status-pill idle">● Idle</span>';
    if (isSOS) {
      statusPill = '<span class="status-pill sos">🚨 SOS ACTIVE</span>';
    } else if (isTracking) {
      statusPill = '<span class="status-pill tracking">🟢 TRACKING</span>';
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #f8fafc;">${u.fullName}</div>
          <div style="font-size: 11px; color: #94a3b8;">ID: ${u.id.substring(0, 8)}...</div>
        </td>
        <td><span class="code-badge">${u.userCode}</span></td>
        <td>${u.phoneNumber}</td>
        <td>${u.email}</td>
        <td>${u.age} yrs • <span style="color: #94a3b8;">${u.address}</span></td>
        <td><i class="fa-solid fa-user-shield" style="color: #ec4899;"></i> ${item.trusteeCount} Guardians</td>
        <td>${statusPill}</td>
        <td style="display: flex; gap: 8px;">
          ${item.activeSos ? `
            <button class="btn-logout" style="background: rgba(239, 68, 68, 0.15); color: var(--sos-red); border: 1px solid var(--sos-red); padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; cursor: pointer;" onclick="adminResolveSOS('${item.activeSos.id}', '${u.id}')">
              <i class="fa-solid fa-power-off"></i> Shut Off SOS
            </button>
          ` : ''}
          <button class="btn-inspect" onclick="openInspectModal('${u.id}')">
            <i class="fa-solid fa-map-location-dot"></i> Inspect Live GPS
          </button>
          <button class="btn-logout" style="padding: 8px 12px; border: none;" onclick="deleteUser('${u.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteUser(userId) {
  if (confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        alert("User deleted successfully.");
        loadAdminUsers(); // refresh the table
      } else {
        const err = await response.json();
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }
}

function filterUsers() {
  const query = document.getElementById('userSearchInput').value.toLowerCase();
  const filtered = allUsers.filter(item => {
    const u = item.user;
    return (
      u.fullName.toLowerCase().includes(query) ||
      u.userCode.toLowerCase().includes(query) ||
      u.phoneNumber.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });
  renderUserTable(filtered);
}

// Inspect Live Modal Map
function openInspectModal(userId) {
  inspectedUserId = userId;
  const userItem = allUsers.find(item => item.user.id === userId);
  if (!userItem) return;

  const u = userItem.user;
  document.getElementById('inspectModalTitle').textContent = `Live GPS: ${u.fullName} (${u.userCode})`;

  const sidebar = document.getElementById('inspectSidebar');
  const lat = userItem.latestLocation ? userItem.latestLocation.latitude : 19.0760;
  const lng = userItem.latestLocation ? userItem.latestLocation.longitude : 72.8777;
  const speed = userItem.latestLocation ? (userItem.latestLocation.speedMPS * 3.6).toFixed(1) : '0.0';
  const battery = userItem.latestLocation ? userItem.latestLocation.batteryLevel : u.batteryLevel;

  sidebar.innerHTML = `
    <div class="profile-avatar">${u.fullName.charAt(0)}</div>
    <div style="font-size: 16px; font-weight: 800;">${u.fullName}</div>
    <div class="code-badge" style="align-self: flex-start;">${u.userCode}</div>
    
    <div class="field-group">
      <div class="field-lbl">Phone Number</div>
      <div class="field-val">${u.phoneNumber}</div>
    </div>
    <div class="field-group">
      <div class="field-lbl">Email Address</div>
      <div class="field-val">${u.email}</div>
    </div>
    <div class="field-group">
      <div class="field-lbl">Age & Address</div>
      <div class="field-val">${u.age} yrs • ${u.address}</div>
    </div>
    <div class="field-group">
      <div class="field-lbl">Live Telemetry</div>
      <div class="field-val" id="adminTelemetryVal">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      <div style="font-size: 11px; color: #94a3b8;" id="adminSpeedBattery">⚡ ${speed} km/h • 🔋 ${battery}%</div>
    </div>
  `;

  if (userItem.activeSos) {
    sidebar.innerHTML += `
      <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border);">
        <button onclick="adminResolveSOS('${userItem.activeSos.id}', '${u.id}')" style="width: 100%; background: rgba(239, 68, 68, 0.15); color: var(--sos-red); border: 1px solid var(--sos-red); padding: 10px; border-radius: 8px; font-weight: 800; cursor: pointer;">
          SHUT OFF SOS OVERRIDE
        </button>
      </div>
    `;
  }

  document.getElementById('inspectModal').classList.add('show');

  // Initialize Map
  setTimeout(() => {
    if (!adminMap) {
      adminMap = L.map('adminMap', { zoomControl: true, attributionControl: false }).setView([lat, lng], 16);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(adminMap);
      
      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: '<div style="width:22px;height:22px;background:#06b6d4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(6,182,212,0.8);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      adminMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(adminMap);
      adminTrail = L.polyline([[lat, lng]], { color: '#06b6d4', weight: 4, opacity: 0.8 }).addTo(adminMap);
    } else {
      adminMap.invalidateSize();
      adminMap.setView([lat, lng], 16);
      adminMarker.setLatLng([lat, lng]);
      adminTrail.setLatLngs([[lat, lng]]);
    }
  }, 200);
}

function closeInspectModal() {
  document.getElementById('inspectModal').classList.remove('show');
  inspectedUserId = null;
}

function inspectFirstSOS() {
  const sosUser = allUsers.find(item => item.activeSos !== null && item.activeSos !== undefined);
  if (sosUser) {
    openInspectModal(sosUser.user.id);
  }
}

// WebSocket Stream for Super-Admin
function connectAdminWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'LOCATION_UPDATE') {
        const lp = msg.payload;
        
        if (inspectedUserId === lp.userId && adminMap && adminMarker) {
          adminMarker.setLatLng([lp.latitude, lp.longitude]);
          adminTrail.addLatLng([lp.latitude, lp.longitude]);
          adminMap.panTo([lp.latitude, lp.longitude]);

          const telem = document.getElementById('adminTelemetryVal');
          if (telem) telem.textContent = `📍 ${lp.latitude.toFixed(4)}, ${lp.longitude.toFixed(4)}`;
          const sb = document.getElementById('adminSpeedBattery');
          if (sb) sb.textContent = `⚡ ${(lp.speedMPS * 3.6).toFixed(1)} km/h • 🔋 ${lp.batteryLevel}%`;
        }

        loadAdminStats();
      } else if (msg.type === 'SOS_TRIGGERED') {
        loadAdminStats();
        loadAdminUsers();
      } else if (msg.type === 'SOS_RESOLVED') {
        loadAdminStats();
        loadAdminUsers();
      }
    } catch (err) {}
  };

  ws.onclose = () => setTimeout(connectAdminWebSocket, 3000);
}

async function adminResolveSOS(sosEventId, userId) {
  if (!confirm("Are you sure you want to forcibly shut off this distress call?")) return;

  try {
    const res = await fetch('/api/admin/sos/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': sessionStorage.getItem('raksha_admin_auth_token')
      },
      body: JSON.stringify({ sosEventId, userId, pin: "" })
    });
    
    if (res.ok) {
      alert("Distress call forcefully resolved by Admin.");
      closeInspectModal();
      loadAdminUsers();
      loadAdminStats();
    } else {
      alert("Failed to resolve SOS.");
    }
  } catch (err) {
    console.error(err);
    alert("Network error: " + err.message);
  }
}

