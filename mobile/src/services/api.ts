import { Platform } from 'react-native';

// Auto-detect base URL: If running in web browser on PC -> use localhost:8080. If on mobile phone -> use Wi-Fi IP.
function getDefaultApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `http://${window.location.hostname}:8080`;
  }
  return 'http://172.26.33.3:8080';
}

export let API_BASE_URL = getDefaultApiUrl();

export function setCustomApiUrl(url: string) {
  API_BASE_URL = url.trim().replace(/\/+$/, '');
}

export interface LocationPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  batteryLevel: number;
  speedMPS: number;
}

export interface SOSPayload {
  userId: string;
  triggerType: string;
  latitude: number;
  longitude: number;
  batteryLevel: number;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export const api = {
  // Step 1: Sign Up (Email, Phone Number, Password)
  async register(email: string, phoneNumber: string, password: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phoneNumber, password })
    }, 6000);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Registration failed');
    }
    return await response.json();
  },

  async requestOTP(email: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }, 6000);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to request OTP');
    }
    return await response.json();
  },

  // Step 2: Login
  async login(identifier: string, password?: string, otp?: string) {
    const body: any = { identifier };
    if (password) body.password = password;
    if (otp) body.otp = otp;

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 6000);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Login failed');
    }
    return await response.json();
  },

  // Step 2: Profile Building Page (Full Name, Age, Address, Real PIN, Fake PIN)
  async completeProfile(userId: string, fullName: string, age: number, address: string, pin: string, fakePin: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/profile-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, fullName, age, address, pin, fakePin })
    }, 6000);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Profile setup failed');
    }
    return await response.json();
  },

  // 2. Trustee Pairing & Connection Requests
  async sendTrusteeRequest(requesterId: string, targetCodeOrPhone: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId,
        targetCode: targetCodeOrPhone.startsWith('RAK-') ? targetCodeOrPhone : '',
        targetPhone: targetCodeOrPhone.startsWith('RAK-') ? '' : targetCodeOrPhone
      })
    }, 6000);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to send request');
    }
    return await response.json();
  },

  async deleteAccount(userId: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/${userId}`, {
      method: 'DELETE',
    }, 5000);
    return await response.json();
  },

  async updateProfile(userId: string, fullName: string, age: number, address: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/${userId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, age, address })
    }, 5000);
    return await response.json();
  },

  async getPendingRequests(userId: string) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/requests?userId=${userId}`, {}, 4000);
      if (response.ok) return await response.json();
      return [];
    } catch (e) {
      return [];
    }
  },

  async respondTrusteeRequest(connectionId: string, userId: string, accept: boolean) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, userId, accept })
    }, 4000);
    return await response.json();
  },

  async getMyTrustees(userId: string) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/my-list?userId=${userId}`, {}, 4000);
      if (response.ok) return await response.json();
      return [];
    } catch (e) {
      return [];
    }
  },

  async getActiveWards(userId: string) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/wards/active?userId=${userId}`, {}, 4000);
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async toggleSharing(connectionId: string, userId: string, enable: boolean) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/trustees/toggle-sharing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, userId, enable })
    }, 4000);
    return await response.json();
  },

  // 3. Location Ingest
  async trackLocation(payload: LocationPayload) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/location/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 4000);
      return await response.json();
    } catch (e) {
      return null;
    }
  },

  async stopTracking(userId: string) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/location/stop/${userId}`, {
        method: 'POST'
      }, 4000);
      return await response.json();
    } catch (e) {
      return null;
    }
  },

  // 4. Emergency SOS
  async triggerSOS(payload: SOSPayload) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/sos/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 4000);
    return await response.json();
  },

  async resolveSOS(sosEventId: string, userId: string, pin: string) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/sos/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sosEventId, userId, pin })
    }, 4000);
    return await response.json();
  }
};
