import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { api } from './api';

let lastSentLat = 0;
let lastSentLng = 0;
let locationWatcher: Location.LocationSubscription | null = null;

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

export async function startTracking(userId: string, isSOS: boolean, onLocation?: (loc: any) => void) {
  stopTracking();

  const granted = await requestLocationPermissions();
  if (!granted) {
    console.warn('Location permission denied');
    return;
  }

  // 1. Immediately get current position on launch
  try {
    const initialPos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (initialPos && onLocation) {
      onLocation({
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
        speed: initialPos.coords.speed || 0,
        batteryLevel: 85,
      });

      api.trackLocation({
        userId,
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
        accuracyMeters: initialPos.coords.accuracy || 5,
        batteryLevel: 85,
        speedMPS: initialPos.coords.speed || 0,
      });
    }
  } catch (e) {}

  // 2. Start continuous watcher
  const timeInterval = isSOS ? 1000 : 3000;
  const distanceInterval = isSOS ? 0 : 2;

  try {
    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: timeInterval,
        distanceInterval: distanceInterval,
      },
      async (location) => {
        const lat = location.coords.latitude;
        const lng = location.coords.longitude;
        const speed = location.coords.speed || 0;
        const accuracy = location.coords.accuracy || 5;

        let batteryLevel = 85;
        try {
          const level = await Battery.getBatteryLevelAsync();
          if (level > 0) batteryLevel = Math.round(level * 100);
        } catch (e) {}

        // Always update UI with real phone GPS
        if (onLocation) {
          onLocation({ latitude: lat, longitude: lng, speed, batteryLevel });
        }

        // Send to backend
        const dist = getDistanceMeters(lastSentLat, lastSentLng, lat, lng);
        const shouldSend = isSOS || lastSentLat === 0 || dist >= 10 || speed > 1.0;

        if (shouldSend) {
          lastSentLat = lat;
          lastSentLng = lng;

          api.trackLocation({
            userId,
            latitude: lat,
            longitude: lng,
            accuracyMeters: accuracy,
            batteryLevel,
            speedMPS: speed,
          });
        }
      }
    );
  } catch (e) {
    console.warn('Watch position error', e);
  }
}

export function stopTracking() {
  if (locationWatcher) {
    locationWatcher.remove();
    locationWatcher = null;
  }
}
