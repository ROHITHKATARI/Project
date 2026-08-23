// ─── Location Service ─────────────────────────────────────────────────
// Uses Capacitor Geolocation on Android (proper native permission model)
// and browser navigator.geolocation on web.
// Results are cached in localStorage for 2 hours.

import { Capacitor } from "@capacitor/core";

export interface UserLocation {
  lat: number;
  lng: number;
  areaName: string;  // e.g. "Koramangala"
  city: string;      // e.g. "Bengaluru"
  fullLabel: string; // e.g. "Koramangala, Bengaluru"
}

const CACHE_KEY = "dw_user_location_v1";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Cache helpers ────────────────────────────────────────────────────
export function getCachedLocation(): UserLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: UserLocation; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheLocation(loc: UserLocation): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: loc, ts: Date.now() }));
  } catch {
    /* quota exceeded or private mode — silently ignore */
  }
}

export function clearCachedLocation(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ─── Reverse geocode via OpenStreetMap Nominatim ──────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<{ areaName: string; city: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "DostWheels/1.0 (bikepooling-app)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) throw new Error("Nominatim request failed");
    const data = await res.json();
    const addr = (data.address ?? {}) as Record<string, string>;

    const areaName =
      addr.neighbourhood || addr.suburb || addr.quarter ||
      addr.village || addr.town || addr.county || "Your area";

    const city =
      addr.city || addr.town || addr.village ||
      addr.state_district || addr.state || "Your city";

    return { areaName, city };
  } catch {
    return { areaName: "Your area", city: "Your city" };
  }
}

// ─── Native GPS via Capacitor Geolocation ─────────────────────────────
async function getNativeLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    // Dynamically import to avoid bundling Capacitor in web-only build paths
    const { Geolocation } = await import("@capacitor/geolocation");

    // Request permissions first — required on Android 6+
    const perm = await Geolocation.requestPermissions();
    if (
      perm.location !== "granted" &&
      perm.coarseLocation !== "granted"
    ) {
      console.warn("[Location] Permission denied on Android");
      return null;
    }

    const pos = await Geolocation.getCurrentPosition({
      timeout: 15000,
      enableHighAccuracy: false,
      maximumAge: 300_000,
    });

    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    console.error("[Location] Capacitor geolocation error:", err);
    return null;
  }
}

// ─── Web GPS via navigator.geolocation ───────────────────────────────
function getWebLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 15000, enableHighAccuracy: false, maximumAge: 300_000 }
    );
  });
}

// ─── Main: request GPS + reverse geocode ─────────────────────────────
export async function requestUserLocation(forceRefresh = false): Promise<UserLocation | null> {
  // Return cached result if fresh enough (unless forced)
  if (!forceRefresh) {
    const cached = getCachedLocation();
    if (cached) return cached;
  }

  // Use the correct GPS API for the platform
  const coords = Capacitor.isNativePlatform()
    ? await getNativeLocation()
    : await getWebLocation();

  if (!coords) return null;

  const { areaName, city } = await reverseGeocode(coords.lat, coords.lng);
  const loc: UserLocation = {
    lat: coords.lat,
    lng: coords.lng,
    areaName,
    city,
    fullLabel: areaName === city ? city : `${areaName}, ${city}`,
  };
  cacheLocation(loc);
  return loc;
}

// ─── Friendly display helpers ─────────────────────────────────────────
export function formatLocationLabel(loc: UserLocation | null): string {
  if (!loc) return "Detecting location...";
  return loc.fullLabel;
}
