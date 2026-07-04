// ─── Location Service ─────────────────────────────────────────────────
// Uses the browser's Geolocation API + OpenStreetMap Nominatim for
// free reverse-geocoding (50k req/day, no API key needed).
// Results are cached in localStorage for 2 hours to avoid repeated prompts.

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
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: loc, ts: Date.now() })
    );
  } catch {
    /* quota exceeded or private mode — silently ignore */
  }
}

export function clearCachedLocation(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ─── Reverse geocode via OpenStreetMap Nominatim ──────────────────────
async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ areaName: string; city: string }> {
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
      addr.neighbourhood ||
      addr.suburb ||
      addr.quarter ||
      addr.village ||
      addr.town ||
      addr.county ||
      "Your area";

    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.state_district ||
      addr.state ||
      "Your city";

    return { areaName, city };
  } catch {
    return { areaName: "Your area", city: "Your city" };
  }
}

// ─── Main: request GPS + reverse geocode ─────────────────────────────
export async function requestUserLocation(): Promise<UserLocation | null> {
  // Return cached result if fresh enough
  const cached = getCachedLocation();
  if (cached) return cached;

  if (!("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const { areaName, city } = await reverseGeocode(lat, lng);
        const loc: UserLocation = {
          lat,
          lng,
          areaName,
          city,
          fullLabel: areaName === city ? city : `${areaName}, ${city}`,
        };
        cacheLocation(loc);
        resolve(loc);
      },
      () => resolve(null), // User denied or timed out
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 300_000 }
    );
  });
}

// ─── Friendly display helpers ─────────────────────────────────────────
export function formatLocationLabel(loc: UserLocation | null): string {
  if (!loc) return "Detecting location...";
  return loc.fullLabel;
}
