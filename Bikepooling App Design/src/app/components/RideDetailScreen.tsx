import { useState, useEffect, useRef, useCallback, Component } from "react";
import React from "react";
import {
  X, MapPin, Clock, MessageCircle, Navigation2,
  Send, Car, Bike, ChevronRight, Star, Loader2,
  RadioTower, Briefcase, Building2, Info, Footprints,
  PhoneCall, Users, DollarSign, Route,
} from "lucide-react";
import type { RidePost } from "../../lib/ridesDb";
import {
  sendJoinRequest as sendRideJoinRequest,
  approveJoinRequest,
  declineJoinRequest,
  getRideById,
} from "../../lib/ridesDb";
import { sendMessage, getMessages, type ChatMessage } from "../../lib/chatDb";
import { updateMyLocation, getRideLocations, type ParticipantLocation } from "../../lib/locationDb";
import { getUserProfile, type UserProfile } from "../../lib/userDb";
import type { UserLocation } from "../../lib/locationService";
import { Capacitor } from "@capacitor/core";
import {
  APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary,
} from "@vis.gl/react-google-maps";

const IS_NATIVE = Capacitor.isNativePlatform();
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

// ─── Palette ──────────────────────────────────────────────────────────
const ROUTE_COLORS = {
  start: "#22c55e",
  end: "#ef4444",
  user: "#3b82f6",
  join: "#f97316",
};

type Tab = "details" | "location" | "chat";

// ─── Props ────────────────────────────────────────────────────────────
interface RideDetailScreenProps {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
  userLocation?: UserLocation | null;
  /** If provided, the screen opens on this tab instead of "details". */
  initialTab?: Tab;
  onClose: () => void;
}


// ─── Helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#3b82f6","#14b8a6","#8b5cf6","#ec4899","#f59e0b","#06b6d4","#10b981"];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatRideDate(dateStr: string, timeStr: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  const label = dateStr === todayStr ? "Today" : dateStr === tomorrowStr ? "Tomorrow" : new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (!timeStr) return label;
  const [h, m] = timeStr.split(":").map(Number);
  return `${label} at ${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const VEHICLE_ICONS: Record<string, string> = { Bike: "🏍️", Scooter: "🛵", Car: "🚗" };

// ─── Haversine ────────────────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Nearest point on a polyline segment ─────────────────────────────
function nearestPointOnSegment(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): { lat: number; lng: number } {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
  return { lat: a.lat + t * dy, lng: a.lng + t * dx };
}

function findNearestJoinPoint(
  user: { lat: number; lng: number },
  points: { lat: number; lng: number }[]
): { point: { lat: number; lng: number }; distanceM: number } | null {
  if (points.length < 2) return null;
  let best: { lat: number; lng: number } | null = null;
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const pt = nearestPointOnSegment(user, points[i], points[i + 1]);
    const d = haversineM(user.lat, user.lng, pt.lat, pt.lng);
    if (d < minDist) { minDist = d; best = pt; }
  }
  return best ? { point: best, distanceM: minDist } : null;
}

// ─── Best Pickup Card ─────────────────────────────────────────────────
function NearestJoinCard({ distanceM }: { distanceM: number }) {
  const walkMinutes = Math.ceil(distanceM / 80);
  if (distanceM < 80) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
          <MapPin className="w-4 h-4" style={{ color: "#16a34a" }} />
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: "#15803d" }}>You can join directly from your current location.</p>
          <p className="text-xs mt-0.5" style={{ color: "#166534" }}>The ride passes near you — no extra walking needed.</p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.15)" }}>
        <Navigation2 className="w-4 h-4" style={{ color: "#ea580c" }} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm" style={{ color: "#9a3412" }}>Best Pickup Point</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#ea580c" }}>
            <MapPin className="w-3 h-3" />
            {distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`} away
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#ea580c" }}>
            <Footprints className="w-3 h-3" />
            {walkMinutes} min walk
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Map Error Boundary ───────────────────────────────────────────────
class MapErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("[RouteMap] error:", error.message); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: "var(--card)", gap: 8 }}>
          <MapPin size={28} style={{ color: "#9297AC" }} />
          <p style={{ color: "#9297AC", fontSize: 13 }}>Map unavailable</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Google Maps Route Inner ──────────────────────────────────────────
function RouteMapGoogleInner({
  ride,
  userLocation,
  onJoinPointFound,
}: {
  ride: RidePost;
  userLocation: UserLocation | null;
  onJoinPointFound: (distanceM: number) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const joinPolyRef = useRef<google.maps.Polyline | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [joinPoint, setJoinPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState(false);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Draw the route
  useEffect(() => {
    if (!map || !routesLib || !ride.fromCoords) return;

    if (!rendererRef.current) {
      rendererRef.current = new routesLib.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: "#2E5BFF",
          strokeOpacity: 0.9,
          strokeWeight: 6,
          zIndex: 2,
        },
      });
    }
    rendererRef.current.setMap(map);
    setRouteLoading(true);
    setRouteError(false);

    new routesLib.DirectionsService().route(
      {
        origin: { lat: ride.fromCoords.lat, lng: ride.fromCoords.lng },
        destination: `${ride.to}, India`,
        travelMode: routesLib.TravelMode.TWO_WHEELER,
      },
      (result, status) => {
        setRouteLoading(false);
        if (status === "OK" && result && rendererRef.current) {
          rendererRef.current.setDirections(result);

          // Collect all polyline points for nearest-join algorithm
          const pts: { lat: number; lng: number }[] = [];
          const legs = result.routes[0]?.legs ?? [];
          legs.forEach((leg) => {
            leg.steps?.forEach((step) => {
              step.path?.forEach((latLng) => {
                pts.push({ lat: latLng.lat(), lng: latLng.lng() });
              });
            });
          });
          setRoutePoints(pts);

          // Destination coords from the response
          const endLeg = legs[legs.length - 1];
          if (endLeg?.end_location) {
            setDestCoords({ lat: endLeg.end_location.lat(), lng: endLeg.end_location.lng() });
          }

          // Fit bounds to show everything
          const bounds = new google.maps.LatLngBounds();
          if (ride.fromCoords) bounds.extend(ride.fromCoords);
          if (endLeg?.end_location) bounds.extend(endLeg.end_location);
          if (userLocation) bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
          }
        } else {
          setRouteError(true);
          // Fallback: at least fit from + user
          if (ride.fromCoords) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(ride.fromCoords);
            if (userLocation) bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
            map.fitBounds(bounds, { top: 60, bottom: 60, left: 30, right: 30 });
          }
        }
      }
    );

    return () => {
      rendererRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, ride.rideId]);

  // Calculate nearest join point when route points + user location available
  useEffect(() => {
    if (!map || !routesLib || routePoints.length < 2 || !userLocation) return;

    // Remove old join connector
    joinPolyRef.current?.setMap(null);
    joinPolyRef.current = null;

    const result = findNearestJoinPoint(userLocation, routePoints);
    if (!result) return;

    setJoinPoint(result.point);
    onJoinPointFound(result.distanceM);

    // Draw dashed connector: user → join point
    joinPolyRef.current = new google.maps.Polyline({
      path: [
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: result.point.lat, lng: result.point.lng },
      ],
      geodesic: true,
      strokeColor: ROUTE_COLORS.join,
      strokeOpacity: 0,
      strokeWeight: 3,
      icons: [
        {
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "14px",
        },
      ],
      map,
      zIndex: 3,
    });

    return () => {
      joinPolyRef.current?.setMap(null);
      joinPolyRef.current = null;
    };
  }, [map, routesLib, routePoints, userLocation, onJoinPointFound]);

  return (
    <>
      {/* Ride Start — green */}
      {ride.fromCoords && (
        <AdvancedMarker position={{ lat: ride.fromCoords.lat, lng: ride.fromCoords.lng }} zIndex={10}>
          <Pin background={ROUTE_COLORS.start} borderColor="#15803d" glyphColor="#fff" />
        </AdvancedMarker>
      )}

      {/* Ride Destination — red */}
      {destCoords && (
        <AdvancedMarker position={destCoords} zIndex={10}>
          <Pin background={ROUTE_COLORS.end} borderColor="#b91c1c" glyphColor="#fff" />
        </AdvancedMarker>
      )}

      {/* User location — blue */}
      {userLocation && (
        <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }} zIndex={12}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            background: ROUTE_COLORS.user,
            border: "3px solid white",
            boxShadow: `0 0 0 6px rgba(59,130,246,0.28), 0 2px 8px rgba(0,0,0,0.3)`,
          }} />
        </AdvancedMarker>
      )}

      {/* Nearest join point — orange */}
      {joinPoint && (
        <AdvancedMarker position={joinPoint} zIndex={11}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: ROUTE_COLORS.join,
            border: "3px solid #ea580c",
            boxShadow: "0 0 0 5px rgba(249,115,22,0.25), 0 2px 8px rgba(0,0,0,0.3)",
          }} />
        </AdvancedMarker>
      )}

      {/* Route error fallback */}
      {routeError && (
        <AdvancedMarker position={ride.fromCoords ?? { lat: 17.385, lng: 78.4867 }}>
          <Pin background="#9297AC" borderColor="#6E7391" glyphColor="#fff" />
        </AdvancedMarker>
      )}

      {/* Loading overlay — managed externally via routeLoading state prop */}
      {routeLoading && (
        <AdvancedMarker position={ride.fromCoords ?? { lat: 17.385, lng: 78.4867 }} zIndex={20}>
          <div style={{ background: "white", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#2E5BFF", boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>
            Loading route…
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}

// ─── Google Maps Route Map ────────────────────────────────────────────
function RouteMapGoogle({
  ride,
  userLocation,
}: {
  ride: RidePost;
  userLocation: UserLocation | null;
}) {
  const [joinDistanceM, setJoinDistanceM] = useState<number | null>(null);
  const defaultCenter = ride.fromCoords
    ? { lat: ride.fromCoords.lat, lng: ride.fromCoords.lng }
    : userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 17.385, lng: 78.4867 };

  const handleJoinPoint = useCallback((d: number) => setJoinDistanceM(d), []);

  return (
    <div className="flex flex-col gap-3">
      {/* Map */}
      <div className="rounded-2xl overflow-hidden" style={{ height: 280, border: "1px solid var(--glass-border)" }}>
        <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={["places", "routes"]}>
          <Map
            mapId="dostwheels-detail-map"
            defaultCenter={defaultCenter}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            style={{ width: "100%", height: "100%" }}
            colorScheme="FOLLOW_SYSTEM"
          >
            <RouteMapGoogleInner
              ride={ride}
              userLocation={userLocation}
              onJoinPointFound={handleJoinPoint}
            />
          </Map>
        </APIProvider>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-1">
        {[
          { color: ROUTE_COLORS.start, label: "Start" },
          { color: ROUTE_COLORS.end, label: "Destination" },
          ...(userLocation ? [{ color: ROUTE_COLORS.user, label: "You" }] : []),
          ...(joinDistanceM !== null ? [{ color: ROUTE_COLORS.join, label: "Join Point" }] : []),
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Nearest join point card */}
      {joinDistanceM !== null && <NearestJoinCard distanceM={joinDistanceM} />}
    </div>
  );
}

// ─── Leaflet Route Map (Android) ──────────────────────────────────────
function RouteMapLeaflet({
  ride,
  userLocation,
}: {
  ride: RidePost;
  userLocation: UserLocation | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [joinDistanceM, setJoinDistanceM] = useState<number | null>(null);
  const [routeError, setRouteError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let leafletMap: import("leaflet").Map | null = null;
    let routePolyline: import("leaflet").Polyline | null = null;
    let joinPolyline: import("leaflet").Polyline | null = null;

    (async () => {
      const L = (await import("leaflet")).default;

      if (!containerRef.current || !isMounted) return;

      const center: [number, number] = ride.fromCoords
        ? [ride.fromCoords.lat, ride.fromCoords.lng]
        : userLocation
        ? [userLocation.lat, userLocation.lng]
        : [17.385, 78.4867];

      leafletMap = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = leafletMap;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "",
      }).addTo(leafletMap);

      // Invalidate size after mount
      setTimeout(() => leafletMap?.invalidateSize(), 150);

      const makeCircleIcon = (color: string, size = 14, glowColor?: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 0 0 4px ${glowColor ?? color}44,0 2px 6px rgba(0,0,0,0.3)"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

      const bounds = L.latLngBounds([]);

      // Start marker
      if (ride.fromCoords) {
        L.marker([ride.fromCoords.lat, ride.fromCoords.lng], { icon: makeCircleIcon(ROUTE_COLORS.start, 16, ROUTE_COLORS.start) })
          .addTo(leafletMap)
          .bindPopup(`<b>Start:</b> ${ride.from}`);
        bounds.extend([ride.fromCoords.lat, ride.fromCoords.lng]);
      }

      // User location marker
      if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng], { icon: makeCircleIcon(ROUTE_COLORS.user, 18, ROUTE_COLORS.user) })
          .addTo(leafletMap);
        bounds.extend([userLocation.lat, userLocation.lng]);
      }

      // Fetch OSRM route
      if (ride.fromCoords) {
        try {
          // First geocode the destination
          const geocodeRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ride.to + ", India")}&format=json&limit=1`,
            { headers: { "User-Agent": "DostWheels/1.0", "Accept-Language": "en" } }
          );
          const geocodeData = await geocodeRes.json() as Array<{ lat: string; lon: string }>;

          if (geocodeData.length > 0 && isMounted) {
            const destLat = parseFloat(geocodeData[0].lat);
            const destLng = parseFloat(geocodeData[0].lon);
            bounds.extend([destLat, destLng]);

            // Destination marker
            L.marker([destLat, destLng], { icon: makeCircleIcon(ROUTE_COLORS.end, 16, ROUTE_COLORS.end) })
              .addTo(leafletMap!)
              .bindPopup(`<b>Destination:</b> ${ride.to}`);

            // OSRM route
            const osrmUrl =
              `https://router.project-osrm.org/route/v1/driving/` +
              `${ride.fromCoords.lng},${ride.fromCoords.lat};${destLng},${destLat}` +
              `?overview=full&geometries=geojson`;
            const routeRes = await fetch(osrmUrl);
            const routeData = await routeRes.json() as {
              routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
            };

            if (routeData.routes?.[0] && isMounted && leafletMap) {
              const coords = routeData.routes[0].geometry.coordinates;
              const latlngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);

              routePolyline = L.polyline(latlngs, {
                color: "#2E5BFF",
                weight: 5,
                opacity: 0.85,
              }).addTo(leafletMap);

              // Nearest join point
              if (userLocation) {
                const pts = latlngs.map(([lat, lng]) => ({ lat, lng }));
                const result = findNearestJoinPoint(userLocation, pts);
                if (result && isMounted) {
                  setJoinDistanceM(result.distanceM);

                  // Orange join point marker
                  L.marker([result.point.lat, result.point.lng], {
                    icon: makeCircleIcon(ROUTE_COLORS.join, 16, ROUTE_COLORS.join),
                  }).addTo(leafletMap!);

                  // Dashed connector line
                  joinPolyline = L.polyline(
                    [[userLocation.lat, userLocation.lng], [result.point.lat, result.point.lng]],
                    { color: ROUTE_COLORS.join, weight: 2, dashArray: "6,8", opacity: 0.8 }
                  ).addTo(leafletMap!);
                }
              }
            } else if (isMounted) {
              setRouteError(true);
            }
          }
        } catch (err) {
          console.error("[RouteMapLeaflet] OSRM error:", err);
          if (isMounted) setRouteError(true);
        }
      }

      // Fit all markers
      if (isMounted && leafletMap && bounds.isValid()) {
        leafletMap.fitBounds(bounds, { padding: [40, 40] });
      }
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.rideId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl overflow-hidden" style={{ height: 280, border: "1px solid var(--glass-border)", position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {routeError && (
          <div style={{
            position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
            background: "rgba(239,68,68,0.9)", color: "white", borderRadius: 8,
            padding: "4px 12px", fontSize: 12,
          }}>
            Could not load route
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-1">
        {[
          { color: ROUTE_COLORS.start, label: "Start" },
          { color: ROUTE_COLORS.end, label: "Destination" },
          ...(userLocation ? [{ color: ROUTE_COLORS.user, label: "You" }] : []),
          ...(joinDistanceM !== null ? [{ color: ROUTE_COLORS.join, label: "Join Point" }] : []),
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
          </div>
        ))}
      </div>

      {joinDistanceM !== null && <NearestJoinCard distanceM={joinDistanceM} />}
    </div>
  );
}

// ─── Platform-aware Interactive Route Map ─────────────────────────────
function InteractiveRouteMap({
  ride,
  userLocation,
}: {
  ride: RidePost;
  userLocation: UserLocation | null;
}) {
  return (
    <MapErrorBoundary>
      {IS_NATIVE ? (
        <RouteMapLeaflet ride={ride} userLocation={userLocation} />
      ) : (
        <RouteMapGoogle ride={ride} userLocation={userLocation} />
      )}
    </MapErrorBoundary>
  );
}

// ─── Member Profile Bottom-Sheet ──────────────────────────────────────
function MemberProfileSheet({
  profile, userId, name, role, onClose,
}: {
  profile: UserProfile | null; userId: string; name: string;
  role: "Host" | "Rider"; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl pb-10"
        style={{ background: "var(--card)", boxShadow: "0 -20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 pt-4 pb-5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: avatarColor(userId) }}
          >
            {initials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{name}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: role === "Host" ? "rgba(59,130,246,0.12)" : "rgba(20,184,166,0.12)",
                  color: role === "Host" ? "var(--primary)" : "#0d9488",
                }}
              >{role}</span>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#f59e0b" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{profile?.rating || "4.8"}</span>
              </div>
              {(profile?.rides ?? 0) > 0 && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>· {profile!.rides} rides</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 pt-4 space-y-4">
          {(profile?.jobTitle || profile?.workplace) && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)" }}>
                <Briefcase className="w-4 h-4" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                {profile?.jobTitle && <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{profile.jobTitle}</p>}
                {profile?.workplace && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{profile.workplace}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {profile?.bio && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.1)" }}>
                <Info className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-sm italic flex-1" style={{ color: "var(--foreground)", lineHeight: 1.6 }}>
                &ldquo;{profile.bio}&rdquo;
              </p>
            </div>
          )}
          {!profile?.jobTitle && !profile?.workplace && !profile?.bio && (
            <div className="rounded-2xl py-6 text-center" style={{ background: "var(--secondary)" }}>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No profile info added yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                Users can add bio &amp; job from their Profile tab
              </p>
            </div>
          )}
          {profile?.createdAt && (
            <p className="text-xs text-center pb-2" style={{ color: "var(--muted-foreground)" }}>
              Member since {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Details ─────────────────────────────────────────────────────
function DetailsTab({
  ride,
  currentUserId,
  currentUserName,
  onToast,
  onRideUpdated,
}: {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
  onToast: (msg: string, type?: "success" | "error") => void;
  onRideUpdated?: () => void;
}) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null>>({});
  const [selectedMember, setSelectedMember] = useState<{
    userId: string; name: string; role: "Host" | "Rider";
  } | null>(null);
  const [reqState, setReqState] = useState<"idle" | "loading" | "sent">("idle");
  const [pendingActions, setPendingActions] = useState<Record<string, "approving" | "declining">>({});
  const isHost = currentUserId === ride.userId;
  const alreadyJoined = ride.joinedByIds?.includes(currentUserId);
  const alreadyRequested = ride.pendingRequestIds?.includes(currentUserId) || reqState === "sent";

  const handleApprove = async (requesterId: string, requesterName: string) => {
    setPendingActions((prev) => ({ ...prev, [requesterId]: "approving" }));
    const result = await approveJoinRequest(ride.rideId, requesterId, requesterName);
    if (result.success) {
      onToast(`${requesterName.split(" ")[0]} approved! 🎉`, "success");
      onRideUpdated?.();
    } else {
      onToast(result.message, "error");
    }
    setPendingActions((prev) => {
      const next = { ...prev };
      delete next[requesterId];
      return next;
    });
  };

  const handleDecline = async (requesterId: string, requesterName: string) => {
    setPendingActions((prev) => ({ ...prev, [requesterId]: "declining" }));
    const result = await declineJoinRequest(ride.rideId, requesterId);
    if (result.success) {
      onToast(`${requesterName.split(" ")[0]}'s request declined.`, "success");
      onRideUpdated?.();
    } else {
      onToast(result.message, "error");
    }
    setPendingActions((prev) => {
      const next = { ...prev };
      delete next[requesterId];
      return next;
    });
  };

  useEffect(() => {
    const ids = [ride.userId, ...(ride.joinedByIds ?? [])].filter(Boolean);
    if (ids.length === 0) return;
    Promise.all(
      ids.map((id) => getUserProfile(id).then((p) => [id, p] as [string, UserProfile | null]).catch(() => [id, null] as [string, null]))
    ).then((entries) => setProfiles(Object.fromEntries(entries)));
  }, [ride.rideId]);

  const handleJoinRequest = async () => {
    if (alreadyJoined || alreadyRequested || reqState === "loading") return;
    setReqState("loading");
    const result = await sendRideJoinRequest(ride.rideId, currentUserId, currentUserName);
    if (result.success) { setReqState("sent"); onToast("Request sent! Rider will be notified 🎉", "success"); }
    else { setReqState("idle"); onToast(result.message, "error"); }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Cost-sharing info banner */}
      <div
        className="rounded-2xl p-3 flex items-center gap-2.5"
        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
      >
        <span className="text-base shrink-0">🚗</span>
        <p className="text-xs font-medium" style={{ color: "var(--primary)", lineHeight: 1.5 }}>
          This ride is for <strong>shared travel expenses only</strong> — not commercial transportation.
        </p>
      </div>

      {/* Member profile sheet */}
      {selectedMember && (
        <MemberProfileSheet
          profile={profiles[selectedMember.userId] ?? null}
          userId={selectedMember.userId}
          name={selectedMember.name}
          role={selectedMember.role}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Host context banner */}
      {isHost && (
        <div
          className="rounded-2xl p-3 flex items-center gap-2"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <span className="text-lg">🎯</span>
          <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            You are the host &middot; Tap any member to view their profile
          </p>
        </div>
      )}

      {/* Host card (joiner view) */}
      {!isHost && (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ride Host</p>
          <button
            className="w-full flex items-center gap-3 text-left"
            onClick={() => setSelectedMember({ userId: ride.userId, name: ride.posterName, role: "Host" })}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: avatarColor(ride.userId), fontSize: "0.85rem" }}
            >
              {initials(ride.posterName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.posterName}</p>
              {profiles[ride.userId]?.jobTitle && (
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  💼 {profiles[ride.userId]!.jobTitle}
                  {profiles[ride.userId]?.workplace ? ` · ${profiles[ride.userId]!.workplace}` : ""}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 fill-current" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>4.8</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>&middot; Tap to view profile</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      )}

      {/* Route */}
      <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Route</p>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ROUTE_COLORS.start }} />
            <div className="w-px flex-1 border-l-2 border-dashed" style={{ borderColor: "var(--border)", minHeight: "24px" }} />
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ROUTE_COLORS.end }} />
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>From</p>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.from}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>To</p>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.to}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {formatRideDate(ride.date, ride.time)}
          </span>
        </div>
      </div>

      {/* Ride Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-3.5" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Seats</p>
          </div>
          <p className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{ride.seatsLeft}</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>of {ride.seats} available</p>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Fare</p>
          </div>
          <p className="font-bold text-lg" style={{ color: "#16a34a" }}>Shared</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Cost sharing</p>
        </div>
      </div>

      {/* Vehicle */}
      {ride.vehicle ? (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vehicle</p>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: "var(--secondary)" }}
            >
              {VEHICLE_ICONS[ride.vehicle.vehicleType] ?? "🚲"}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg" style={{ color: "var(--foreground)", lineHeight: 1.2 }}>
                {ride.vehicle.vehicleModel}
              </p>
              {ride.vehicle.year && (
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{ride.vehicle.year}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.12)", color: "var(--primary)" }}>
                  {ride.vehicle.vehicleType}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                  {ride.vehicle.vehicleColor}
                </span>
                {ride.vehicle.vehicleNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium font-mono" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>
                    {ride.vehicle.vehicleNumber}
                  </span>
                )}
                {ride.vehicle.rcNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(139,92,246,0.12)", color: "#7c3aed" }}>
                    RC ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "var(--secondary)", border: "1px dashed var(--border)" }}>
          <Bike className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Vehicle details not provided</p>
        </div>
      )}

      {/* Members */}
      <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Members ({1 + (ride.joinedByIds?.length ?? 0)})
        </p>
        <div className="space-y-1">
          <button
            className="w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left transition-all active:scale-[0.99]"
            style={{ background: isHost ? "rgba(59,130,246,0.06)" : "transparent" }}
            onClick={() => setSelectedMember({ userId: ride.userId, name: ride.posterName, role: "Host" })}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
              style={{ background: avatarColor(ride.userId) }}
            >
              {initials(ride.posterName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {ride.posterName}
                {ride.userId === currentUserId && (
                  <span className="font-normal text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>(you)</span>
                )}
              </p>
              {profiles[ride.userId]?.jobTitle && (
                <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                  {profiles[ride.userId]!.jobTitle}
                </p>
              )}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(59,130,246,0.12)", color: "var(--primary)" }}>
              Host
            </span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          </button>

          {(ride.joinedByNames ?? []).map((name, i) => {
            const uid = ride.joinedByIds?.[i] ?? name;
            return (
              <button
                key={i}
                className="w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left transition-all active:scale-[0.99]"
                style={{ background: uid === currentUserId ? "rgba(20,184,166,0.06)" : "transparent" }}
                onClick={() => setSelectedMember({ userId: uid, name, role: "Rider" })}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: avatarColor(uid) }}
                >
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {name}
                    {uid === currentUserId && (
                      <span className="font-normal text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>(you)</span>
                    )}
                  </p>
                  {profiles[uid]?.jobTitle && (
                    <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{profiles[uid]!.jobTitle}</p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(20,184,166,0.12)", color: "#0d9488" }}>
                  Rider
                </span>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending Requests — host only */}
      {isHost && (ride.pendingRequestIds?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p
            className="text-xs font-semibold mb-3 uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            Pending Requests ({ride.pendingRequestIds!.length})
          </p>
          <div className="space-y-2">
            {(ride.pendingRequestIds ?? []).map((requesterId, i) => {
              const requesterName = ride.pendingRequestNames?.[i] ?? "Rider";
              const action = pendingActions[requesterId];
              return (
                <div
                  key={requesterId}
                  className="flex items-center gap-3 py-2 px-2 rounded-xl"
                  style={{ background: "var(--secondary)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: avatarColor(requesterId) }}
                  >
                    {initials(requesterName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                      {requesterName}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Wants to join</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(requesterId, requesterName)}
                      disabled={!!action}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}
                    >
                      {action === "approving"
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : "Approve"}
                    </button>
                    <button
                      onClick={() => handleDecline(requesterId, requesterName)}
                      disabled={!!action}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}
                    >
                      {action === "declining"
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : "Decline"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {ride.notes && (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Notes from host</p>
          <p className="text-sm italic" style={{ color: "var(--foreground)", lineHeight: 1.6 }}>
            &ldquo;{ride.notes}&rdquo;
          </p>
        </div>
      )}

      {/* Join / Action Buttons */}
      {!isHost && (
        <div className="space-y-3 pt-1">
          <button
            onClick={handleJoinRequest}
            disabled={alreadyJoined || alreadyRequested || reqState === "loading" || ride.seatsLeft === 0}
            className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: alreadyJoined
                ? "linear-gradient(135deg,#16a34a,#22c55e)"
                : alreadyRequested
                ? "linear-gradient(135deg,#f59e0b,#fbbf24)"
                : ride.seatsLeft === 0
                ? "var(--muted)"
                : "linear-gradient(135deg,#2E5BFF,#6b8fff)",
              boxShadow: alreadyJoined
                ? "0 4px 16px rgba(22,163,74,0.35)"
                : alreadyRequested
                ? "0 4px 16px rgba(245,158,11,0.35)"
                : "0 4px 16px rgba(46,91,255,0.4)",
              fontSize: "1rem",
            }}
          >
            {reqState === "loading" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : alreadyJoined ? (
              <><span>✅</span> Already Joined</>
            ) : alreadyRequested ? (
              <><Send className="w-4 h-4" /> Request Sent</>
            ) : ride.seatsLeft === 0 ? (
              "Ride Full"
            ) : (
              <><Route className="w-4 h-4" /> Request to Join</>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              className="py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--card)", border: "1px solid var(--glass-border)", color: "var(--foreground)" }}
            >
              <MessageCircle className="w-4 h-4" style={{ color: "var(--primary)" }} />
              Chat Driver
            </button>
            <button
              className="py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--card)", border: "1px solid var(--glass-border)", color: "var(--foreground)" }}
            >
              <PhoneCall className="w-4 h-4" style={{ color: "#16a34a" }} />
              Call Driver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Interactive Route Map + Live Location ────────────────────────
function LocationTab({
  ride,
  currentUserId,
  currentUserName,
  userLocation,
}: {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
  userLocation: UserLocation | null;
}) {
  const [sharing, setSharing] = useState(false);
  const [locations, setLocations] = useState<ParticipantLocation[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [shareError, setShareError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const fetchLocations = useCallback(async () => {
    const locs = await getRideLocations(ride.rideId);
    setLocations(locs);
    setLoadingLoc(false);
  }, [ride.rideId]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10_000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const toggleSharing = () => {
    if (sharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharing(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setShareError("Your browser does not support geolocation.");
      return;
    }

    setShareError(null);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        await updateMyLocation(
          ride.rideId,
          currentUserId,
          currentUserName,
          pos.coords.latitude,
          pos.coords.longitude
        );
        fetchLocations();
      },
      (err) => {
        setShareError(err.code === 1 ? "Location permission denied." : "Could not get location.");
        setSharing(false);
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
    watchIdRef.current = id;
    setSharing(true);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 pb-6">
      {/* Interactive Route Map */}
      <InteractiveRouteMap ride={ride} userLocation={userLocation} />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Live Location</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Share toggle */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: sharing ? "rgba(16,185,129,0.12)" : "var(--secondary)" }}
          >
            {sharing
              ? <RadioTower className="w-5 h-5" style={{ color: "#10b981" }} />
              : <Navigation2 className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
            }
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {sharing ? "Sharing your location" : "Share my location"}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {sharing ? "Visible to all ride members" : "Let others see where you are"}
            </p>
          </div>
        </div>
        <button
          onClick={toggleSharing}
          className="w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0"
          style={{ background: sharing ? "#10b981" : "var(--muted)" }}
        >
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow"
            style={{ left: sharing ? "26px" : "2px" }}
          />
        </button>
      </div>

      {shareError && (
        <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--destructive)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {shareError}
        </div>
      )}

      {/* Participants */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}
      >
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Member Locations
        </p>
        {loadingLoc ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: "var(--muted-foreground)" }}>
            No one has shared their location yet.
          </p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.userId} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: avatarColor(loc.userId) }}
                >
                  {initials(loc.userName)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {loc.userName} {loc.userId === currentUserId && <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>(you)</span>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Updated {timeAgo(loc.updatedAt)}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
        Locations refresh every 10 seconds
      </p>
    </div>
  );
}

// ─── Tab: Group Chat ──────────────────────────────────────────────────
function ChatTab({
  ride,
  currentUserId,
  currentUserName,
}: {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (initial = false) => {
    const msgs = await getMessages(ride.rideId);
    setMessages(msgs);
    setLoadingChat(false);
    if (initial || msgs.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: initial ? "auto" : "smooth" }), 50);
    }
  }, [ride.rideId]);

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 5_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const optimistic: ChatMessage = {
      rideId: ride.rideId,
      messageId: `${new Date().toISOString()}#optimistic`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    await sendMessage(ride.rideId, currentUserId, currentUserName, text);
    setSending(false);
    fetchMessages(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "360px" }}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loadingChat ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--secondary)" }}>
              <MessageCircle className="w-7 h-7" style={{ color: "var(--muted-foreground)" }} />
            </div>
            <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
              No messages yet.<br />Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.messageId}
                className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2 items-end`}
              >
                {!isMe && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: avatarColor(msg.senderId), fontSize: "0.65rem", marginBottom: "2px" }}
                  >
                    {initials(msg.senderName)}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isMe && (
                    <p className="text-xs font-semibold px-1" style={{ color: "var(--muted-foreground)" }}>
                      {msg.senderName.split(" ")[0]}
                    </p>
                  )}
                  <div
                    className="px-3.5 py-2.5 rounded-2xl"
                    style={{
                      background: isMe
                        ? "linear-gradient(135deg, var(--primary), #6d28d9)"
                        : "var(--card)",
                      color: isMe ? "white" : "var(--foreground)",
                      border: isMe ? "none" : "1px solid var(--glass-border)",
                      borderBottomRightRadius: isMe ? "6px" : "16px",
                      borderBottomLeftRadius: isMe ? "16px" : "6px",
                      boxShadow: isMe ? "0 2px 12px rgba(109,40,217,0.25)" : "none",
                    }}
                  >
                    <p className="text-sm" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>{msg.text}</p>
                  </div>
                  <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
                    {formatTime(msg.sentAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="px-4 py-3 flex items-end gap-3"
        style={{ borderTop: "1px solid var(--glass-border)", background: "var(--background)" }}
      >
        <div
          className="flex-1 rounded-2xl px-4 py-2.5 flex items-center"
          style={{ background: "var(--card)", border: "1px solid var(--glass-border)", minHeight: "44px" }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none"
            style={{ color: "var(--foreground)", fontSize: "0.9rem", maxHeight: "100px", lineHeight: 1.5 }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--primary), #6d28d9)", boxShadow: "0 4px 14px rgba(109,40,217,0.35)" }}
        >
          {sending
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Send className="w-5 h-5 text-white" />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Root: RideDetailScreen ───────────────────────────────────────────
export function RideDetailScreen({
  ride,
  currentUserId,
  currentUserName,
  userLocation,
  initialTab,
  onClose,
}: RideDetailScreenProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "details");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [liveRide, setLiveRide] = useState<RidePost>(ride);

  // Fix A: always load a fresh copy from DynamoDB so pendingRequestIds reflects
  // the latest state — the prop is a stale in-memory snapshot from the list.
  const refreshRide = useCallback(async () => {
    try {
      const fresh = await getRideById(ride.rideId);
      if (fresh) setLiveRide(fresh);
    } catch {
      // Non-fatal — keep showing existing data
    }
  }, [ride.rideId]);

  useEffect(() => {
    refreshRide();
  }, [refreshRide]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "details",  label: "Details",  icon: <Car className="w-4 h-4" /> },
    { id: "location", label: "Route Map", icon: <Route className="w-4 h-4" /> },
    { id: "chat",     label: "Chat",     icon: <MessageCircle className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl text-white text-sm font-medium shadow-xl"
          style={{
            background: toast.type === "success" ? "rgba(22,163,74,0.95)" : "rgba(220,38,38,0.95)",
            backdropFilter: "blur(16px)",
            whiteSpace: "nowrap",
          }}
        >
          {toast.type === "success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
          style={{ background: "var(--secondary)", color: "var(--foreground)" }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate" style={{ fontSize: "1rem", color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {ride.from} → {ride.to}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            Hosted by {ride.posterName}
          </p>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            background: ride.seatsLeft > 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: ride.seatsLeft > 0 ? "#16a34a" : "#dc2626",
          }}
        >
          {ride.seatsLeft > 0 ? `${ride.seatsLeft} seats left` : "Full"}
        </span>
      </div>

      {/* Tab bar */}
      <div
        className="flex px-4 py-2 gap-1 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? "var(--primary)" : "transparent",
              color: tab === t.id ? "white" : "var(--muted-foreground)",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "details" && (
          <div className="px-4 pt-4">
            <DetailsTab
              ride={liveRide}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onToast={showToast}
              onRideUpdated={refreshRide}
            />
          </div>
        )}
        {tab === "location" && (
          <div className="px-4 pt-4">
            <LocationTab
              ride={ride}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              userLocation={userLocation ?? null}
            />
          </div>
        )}
        {tab === "chat" && (
          <ChatTab ride={ride} currentUserId={currentUserId} currentUserName={currentUserName} />
        )}
      </div>
    </div>
  );
}
