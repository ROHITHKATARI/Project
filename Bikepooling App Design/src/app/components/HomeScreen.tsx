import { useState, useEffect, useCallback, useRef, Component } from "react";
import {
  Bell, SlidersHorizontal, MapPin, ShieldCheck, Star,
  ChevronRight, Zap, Clock, RefreshCw, Loader2, X, Calendar, Send, CheckCircle2,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary,
} from "@vis.gl/react-google-maps";
// Leaflet CSS is mandatory — without it tiles render without position/z-index,
// causing the "overlapping tiles" bug seen on Android.
import "leaflet/dist/leaflet.css";
import { PlacesAutocomplete } from "./PlacesAutocomplete";
import { getAllOpenRides, sendJoinRequest, type RidePost } from "../../lib/ridesDb";
import { UserLocation } from "../../lib/locationService";

// ── Platform detection ────────────────────────────────────────────────
const IS_NATIVE = Capacitor.isNativePlatform();
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const NEARBY_RADIUS_KM = 25;

interface HomeScreenProps {
  user: { id: string; name: string; email: string; avatar?: string };
  onRequestRide: (ride: { rider: string }) => void;
  userLocation?: UserLocation | null;
  onGoProfile?: () => void;
  onNotifications?: () => void;
}

interface SearchFilters { from: string; to: string; date: string; minSeats: number; todayOnly: boolean; }
const DEFAULT_FILTERS: SearchFilters = { from: "", to: "", date: "", minSeats: 1, todayOnly: false };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function isRideActive(ride: RidePost): boolean {
  try { return (Date.now() - new Date(`${ride.date}T${ride.time}:00`).getTime()) / 60000 < 60; } catch { return true; }
}
function isRideLive(ride: RidePost): boolean {
  try { const d = (Date.now() - new Date(`${ride.date}T${ride.time}:00`).getTime()) / 60000; return d >= 0 && d < 60; } catch { return false; }
}
function formatDate(d: string): string {
  try {
    const date = new Date(d + "T00:00:00"), today = new Date(), tom = new Date();
    tom.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tom.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return d; }
}
function formatTime(t: string): string {
  try { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; } catch { return t; }
}
const AVATAR_COLORS = ["#2E5BFF","#8b5cf6","#14b8a6","#ec4899","#f59e0b","#10b981","#f97316"];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

// ─── Map Error Boundary ───────────────────────────────────────────────────────
class MapErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("[Map] error caught:", error.message); }
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

// ─── Leaflet Map (Android / native) ──────────────────────────────────────────
// Uses OpenStreetMap tiles — no API key, no referrer restrictions.
// Leaflet CSS is imported statically above (mandatory for correct tile rendering).
function LeafletMap({ userLocation, rides }: {
  userLocation: UserLocation | null;
  rides: { ride: RidePost; distKm: number | null }[];
}) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [17.385, 78.4867];

  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet")["MapContainer"];
    TileLayer: typeof import("react-leaflet")["TileLayer"];
    Marker: typeof import("react-leaflet")["Marker"];
    useMap: typeof import("react-leaflet")["useMap"];
    L: typeof import("leaflet");
  } | null>(null);

  // Load react-leaflet + leaflet once on mount
  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet")])
      .then(([rl, L]) => {
        // Fix default marker icons (Leaflet + Vite/webpack bundler issue)
        (L.default.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
        setMapComponents({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          useMap: rl.useMap,
          L: L.default,
        });
      })
      .catch(console.error);
  }, []);

  if (!MapComponents) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "var(--card)" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#2E5BFF" }} />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, useMap: useLeafletMap, L } = MapComponents;

  // MapSizer: calls invalidateSize() after mount to fix tile layout
  // on Android where the container dimensions may not be known at init time.
  function MapSizer() {
    const map = useLeafletMap();
    useEffect(() => {
      if (!map) return;
      // Brief delay ensures the container has final dimensions before resize
      const t = setTimeout(() => { map.invalidateSize(); }, 150);
      return () => clearTimeout(t);
    }, [map]);
    return null;
  }

  const userIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#2E5BFF;border:3px solid white;box-shadow:0 0 0 6px rgba(46,91,255,0.28),0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  const rideIcon = L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#FFB020;border:2.5px solid #d97706;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <MapContainer
      center={center}
      zoom={13}
      // width/height fills the 280px parent container.
      // zIndex:0 forces leaflet-container to create its own CSS stacking context
      // (position:relative + integer z-index = new stacking context).
      // Without this, Leaflet's internal panes (tile-pane z-200, overlay-pane z-400…)
      // bleed into the parent stacking order and render ON TOP of the greeting/
      // notification divs that have z-10 (z-index:10). With zIndex:0 here, all
      // internal Leaflet z-indices stay inside the map's stacking context, and
      // the parent's z-10 elements (greeting, bell, search bar) appear above the map.
      style={{ width: "100%", height: "100%", zIndex: 0 }}
      zoomControl={false}
      attributionControl={false}
    >
      <MapSizer />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution=""
      />
      {rides.map(({ ride }) =>
        ride.fromCoords ? (
          <Marker
            key={`pin-${ride.rideId}`}
            position={[ride.fromCoords.lat, ride.fromCoords.lng]}
            icon={rideIcon}
          />
        ) : null
      )}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />
      )}
    </MapContainer>
  );
}


// ─── Google Maps (Web) ───────────────────────────────────────────────────────
function RoutePolyline({ fromCoords, toAddress }: { fromCoords: { lat: number; lng: number }; toAddress: string }) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map || !routesLib) return;
    if (!rendererRef.current) {
      rendererRef.current = new routesLib.DirectionsRenderer({
        suppressMarkers: true, preserveViewport: true,
        polylineOptions: { strokeColor: "#2E5BFF", strokeOpacity: 0.72, strokeWeight: 4 },
      });
    }
    rendererRef.current.setMap(map);
    new routesLib.DirectionsService().route(
      { origin: fromCoords, destination: `${toAddress}, Hyderabad, Telangana, India`, travelMode: routesLib.TravelMode.TWO_WHEELER },
      (result, status) => { if (status === "OK" && result && rendererRef.current) rendererRef.current.setDirections(result); }
    );
    return () => { rendererRef.current?.setMap(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, fromCoords.lat, fromCoords.lng, toAddress]);
  return null;
}

function MapCenterer({ userLocation }: { userLocation: UserLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && userLocation) map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
  }, [map, userLocation]);
  return null;
}

function GoogleMapInner({ userLocation, rides }: {
  userLocation: UserLocation | null;
  rides: { ride: RidePost; distKm: number | null }[];
}) {
  const defaultCenter = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 17.385, lng: 78.4867 };
  return (
    <Map mapId="bikepooling-home-map" defaultCenter={defaultCenter} defaultZoom={13}
      gestureHandling="greedy" disableDefaultUI={true}
      style={{ width: "100%", height: "100%" }} colorScheme="FOLLOW_SYSTEM">
      <MapCenterer userLocation={userLocation} />
      {rides.map(({ ride }) => ride.fromCoords ? (
        <RoutePolyline key={`route-${ride.rideId}`} fromCoords={ride.fromCoords} toAddress={ride.to} />
      ) : null)}
      {rides.map(({ ride }) => ride.fromCoords ? (
        <AdvancedMarker key={`pin-${ride.rideId}`}
          position={{ lat: ride.fromCoords.lat, lng: ride.fromCoords.lng }}
          title={`${ride.posterName}: ${ride.from} → ${ride.to}`}>
          <Pin background="#FFB020" borderColor="#d97706" glyphColor="#fff" scale={0.9} />
        </AdvancedMarker>
      ) : null)}
      {userLocation && (
        <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2E5BFF",
            border: "3px solid white", boxShadow: "0 0 0 6px rgba(46,91,255,0.28), 0 2px 8px rgba(0,0,0,0.3)" }} />
        </AdvancedMarker>
      )}
    </Map>
  );
}

// ─── Platform-aware Map Router ────────────────────────────────────────────────
function HomeMap({
  userLocation, rides,
}: {
  userLocation: UserLocation | null;
  rides: { ride: RidePost; distKm: number | null }[];
}) {
  if (IS_NATIVE) {
    return (
      <MapErrorBoundary>
        <LeafletMap userLocation={userLocation} rides={rides} />
      </MapErrorBoundary>
    );
  }
  return (
    <MapErrorBoundary>
      <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={["places", "routes"]}>
        <GoogleMapInner userLocation={userLocation} rides={rides} />
      </APIProvider>
    </MapErrorBoundary>
  );
}

// ─── Ride Card ────────────────────────────────────────────────────────────────
function RideCard({ ride, distanceKm, userId, userName, onToast }: {
  ride: RidePost; distanceKm: number | null; userId: string; userName: string;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const initials = ride.posterName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const color = getAvatarColor(ride.posterName);
  const live = isRideLive(ride);
  const [reqState, setReqState] = useState<"idle" | "loading" | "sent">("idle");
  const alreadyJoined = ride.joinedByIds?.includes(userId);
  const alreadyRequested = ride.pendingRequestIds?.includes(userId) || reqState === "sent";

  const handleRequest = async () => {
    if (alreadyJoined || alreadyRequested || reqState === "loading") return;
    setReqState("loading");
    const result = await sendJoinRequest(ride.rideId, userId, userName);
    if (result.success) { setReqState("sent"); onToast("Request sent! Rider will be notified", "success"); }
    else { setReqState("idle"); onToast(result.message, "error"); }
  };

  return (
    <div className="rounded-2xl border p-3.5 flex items-center gap-3 transition-all active:scale-[0.99]"
      style={{ background: "var(--card)", borderColor: live ? "rgba(34,197,94,0.35)" : "var(--border)",
        boxShadow: live ? "0 2px 14px rgba(34,197,94,0.1)" : "0 1px 6px rgba(20,18,43,0.04)" }}>
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
          style={{ background: color, fontFamily: "'Space Grotesk', sans-serif" }}>{initials}</div>
        <span className="absolute -bottom-1 -right-1 rounded-full shadow-sm" style={{ background: "var(--background-solid)" }}>
          <ShieldCheck size={14} className="text-[#2E5BFF]" style={{ fill: "rgba(46,91,255,0.14)" }} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {ride.posterName}
          </p>
          {live && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse inline-block" />Live
            </span>
          )}
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            <Star size={11} style={{ fill: "#FFB020", color: "#FFB020" }} />
            <span className="text-[11px]" style={{ color: "#8890A6" }}>5.0</span>
          </div>
        </div>
        <p className="text-[12px] mt-0.5 truncate" style={{ color: "#6E7391" }}>
          {ride.from}<span style={{ color: "#C7CBDD", margin: "0 3px" }}>→</span>{ride.to}
        </p>
        <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
          <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
            <Clock size={9} />{formatDate(ride.date)}, {formatTime(ride.time)}
          </span>
          <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
            {ride.seatsLeft} seat{ride.seatsLeft !== 1 ? "s" : ""} left
          </span>
          {distanceKm !== null && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: "rgba(46,91,255,0.08)", color: "#2E5BFF" }}>
              {distanceKm < 1 ? "<1 km" : `${distanceKm.toFixed(1)} km`}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <button onClick={handleRequest} disabled={alreadyJoined || alreadyRequested || reqState === "loading"}
          className="text-[11.5px] font-semibold px-3.5 py-2 rounded-xl text-white transition-all disabled:opacity-70 flex items-center justify-center gap-1"
          style={{
            background: alreadyJoined ? "linear-gradient(135deg,#16a34a,#22c55e)" : alreadyRequested ? "linear-gradient(135deg,#f59e0b,#fbbf24)" : "linear-gradient(135deg,#2E5BFF,#6b8fff)",
            minWidth: 68,
            boxShadow: alreadyJoined ? "0 3px 10px rgba(22,163,74,0.3)" : alreadyRequested ? "0 3px 10px rgba(245,158,11,0.3)" : "0 3px 10px rgba(46,91,255,0.35)",
          }}>
          {reqState === "loading" ? <Loader2 size={12} className="animate-spin" />
            : alreadyJoined ? <><CheckCircle2 size={11} /> Joined</>
            : alreadyRequested ? <><Send size={11} /> Sent</>
            : "Join"}
        </button>
      </div>
    </div>
  );
}

// ─── Search Drawer ────────────────────────────────────────────────────────────
function SearchDrawer({ open, onClose, onApply, allRides }: {
  open: boolean; onClose: () => void; onApply: (f: SearchFilters) => void; allRides: RidePost[];
}) {
  const [f, setF] = useState<SearchFilters>(DEFAULT_FILTERS);
  const uniqueFroms = [...new Set(allRides.map((r) => r.from))].sort();
  const uniqueTos = [...new Set(allRides.map((r) => r.to))].sort();
  const todayStr = new Date().toISOString().split("T")[0];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div className="w-full rounded-t-3xl p-6 pb-10" style={{ background: "var(--card)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 -20px 60px rgba(0,0,0,0.2)" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>Filter Rides</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--secondary)" }}>
            <X size={16} style={{ color: "#6E7391" }} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#9297AC" }}>FROM</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#2E5BFF" }} />
              <input list="from-list" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}
                style={{ background: "var(--card)", borderColor: f.from ? "var(--primary)" : "var(--border)", color: "var(--foreground)" }} />
              <datalist id="from-list">{uniqueFroms.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#9297AC" }}>TO</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#FFB020" }} />
              <input list="to-list" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}
                style={{ background: "var(--card)", borderColor: f.to ? "var(--primary)" : "var(--border)", color: "var(--foreground)" }} />
              <datalist id="to-list">{uniqueTos.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#9297AC" }}>DATE</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#2E5BFF" }} />
                <input type="date" min={todayStr} value={f.date}
                  onChange={(e) => setF({ ...f, date: e.target.value, todayOnly: false })}
                  style={{ background: "var(--card)", borderColor: f.date ? "#2E5BFF" : "var(--border)", color: "var(--foreground)", colorScheme: "light" }} />
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#9297AC" }}>QUICK</label>
              <button onClick={() => setF({ ...f, todayOnly: !f.todayOnly, date: "" })}
                className="py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: f.todayOnly ? "#2E5BFF" : "var(--secondary)", color: f.todayOnly ? "white" : "var(--muted-foreground)" }}>
                Today only
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#9297AC" }}>
              MIN SEATS: <span style={{ color: "#2E5BFF" }}>{f.minSeats}</span>
            </label>
            <input type="range" min={1} max={4} value={f.minSeats}
              onChange={(e) => setF({ ...f, minSeats: +e.target.value })} className="w-full accent-[#2E5BFF]" />
            <div className="flex justify-between text-xs mt-1" style={{ color: "#9297AC" }}><span>1 seat</span><span>4 seats</span></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setF(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS); onClose(); }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
            Clear all
          </button>
          <button onClick={() => { onApply(f); onClose(); }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#2E5BFF,#6b8fff)", boxShadow: "0 4px 14px rgba(46,91,255,0.4)" }}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main HomeScreen ──────────────────────────────────────────────────────────
export function HomeScreen({ user, onRequestRide, userLocation, onGoProfile, onNotifications }: HomeScreenProps) {
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [allRides, setAllRides] = useState<RidePost[]>([]);
  const [nearbyRides, setNearbyRides] = useState<{ ride: RidePost; distKm: number | null }[]>([]);
  const [displayRides, setDisplayRides] = useState<{ ride: RidePost; distKm: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const processRides = useCallback((all: RidePost[]) => {
    const others = all.filter((r) => r.userId !== user.id && isRideActive(r));
    const ranked = others.map((ride) => {
      if (userLocation && ride.fromCoords) {
        return { ride, distKm: haversineKm(userLocation.lat, userLocation.lng, ride.fromCoords.lat, ride.fromCoords.lng) };
      }
      return { ride, distKm: null };
    });
    const filtered = userLocation
      ? ranked.filter((r) => r.distKm === null || r.distKm <= NEARBY_RADIUS_KM).sort((a, b) => (a.distKm ?? 999) - (b.distKm ?? 999))
      : ranked;
    setAllRides(others); setNearbyRides(filtered); setDisplayRides(filtered.slice(0, 10)); setLastRefresh(new Date());
  }, [user.id, userLocation]);

  const fetchRides = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try { const all = await getAllOpenRides(); processRides(all); }
    catch (err) { console.error("HomeScreen fetch error:", err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [processRides]);

  useEffect(() => { fetchRides(false); }, [fetchRides]);
  useEffect(() => { const id = setInterval(() => fetchRides(true), 90_000); return () => clearInterval(id); }, [fetchRides]);

  const applyFilters = useCallback((f: SearchFilters, text: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    let results = nearbyRides;
    if (text.trim()) { const q = text.toLowerCase(); results = results.filter(({ ride }) => ride.from.toLowerCase().includes(q) || ride.to.toLowerCase().includes(q) || ride.posterName.toLowerCase().includes(q)); }
    if (f.from) results = results.filter(({ ride }) => ride.from.toLowerCase().includes(f.from.toLowerCase()));
    if (f.to)   results = results.filter(({ ride }) => ride.to.toLowerCase().includes(f.to.toLowerCase()));
    if (f.todayOnly) results = results.filter(({ ride }) => ride.date === todayStr);
    else if (f.date) results = results.filter(({ ride }) => ride.date === f.date);
    if (f.minSeats > 1) results = results.filter(({ ride }) => ride.seatsLeft >= f.minSeats);
    setDisplayRides(results.slice(0, 20));
    let count = 0; if (f.from) count++; if (f.to) count++; if (f.date || f.todayOnly) count++; if (f.minSeats > 1) count++;
    setActiveFiltersCount(count);
  }, [nearbyRides]);

  useEffect(() => { applyFilters(filters, searchText); }, [nearbyRides, filters, searchText, applyFilters]);

  const timeSince = Math.round((Date.now() - lastRefresh.getTime()) / 1000);
  const refreshLabel = timeSince < 60 ? "Just now" : `${Math.round(timeSince / 60)}m ago`;

  return (
    <div className="flex flex-col pb-6" style={{ fontFamily: "'Inter', sans-serif", background: "var(--background-solid)", minHeight: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-medium flex items-center gap-2 shadow-xl"
          style={{ background: toast.type === "success" ? "rgba(22,163,74,0.95)" : toast.type === "error" ? "rgba(220,38,38,0.95)" : "rgba(20,18,43,0.88)", backdropFilter: "blur(20px)", whiteSpace: "nowrap" }}>
          {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"} {toast.msg}
        </div>
      )}

      <SearchDrawer open={showSearch} onClose={() => setShowSearch(false)} onApply={(f) => setFilters(f)} allRides={allRides} />

      {/* MAP HEADER */}
      {/*
        isolation:isolate creates a new stacking context for the map wrapper.
        This traps Leaflet's internal panes (tile-pane z-200, overlay-pane z-400,
        etc.) inside the map's own stacking context so they cannot paint on top
        of the greeting / bell / search bar overlays that live alongside the map.
      */}
      <div className="relative" style={{ height: 280, flexShrink: 0, isolation: "isolate" }}>
        {/* Leaflet CSS — injected only on Android */}
        {IS_NATIVE && (
          <style>{`
            .leaflet-container { background: #e8edf3; }
            .leaflet-tile-pane { -webkit-filter: none; filter: none; }
          `}</style>
        )}
        {/* Map fills the container; its z-index:0 keeps it at the bottom of
            this isolated stacking context. All overlay divs below use
            position:absolute with a z-index > 0 to stay on top. */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <HomeMap userLocation={userLocation ?? null} rides={displayRides} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, var(--background-solid) 0%, transparent 100%)", zIndex: 1 }} />

        {/* Greeting + Bell */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between" style={{ zIndex: 10 }}>
          <div className="px-3.5 py-2 rounded-2xl" style={{ background: "rgba(20,18,43,0.72)", backdropFilter: "blur(14px)" }}>
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{greeting}</p>
            <h1 className="text-white leading-tight font-semibold" style={{ fontSize: "1.15rem", fontFamily: "'Space Grotesk', sans-serif" }}>
              {firstName} 👋
            </h1>
          </div>
          <button
            onClick={onNotifications}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80"
            style={{ background: "rgba(20,18,43,0.72)", backdropFilter: "blur(14px)" }}
            aria-label="Notifications"
          >
            <Bell size={17} className="text-white" />
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-[#FFB020]" />
          </button>
        </div>

        {/* Location tag */}
        <div className="absolute" style={{ top: 76, left: 16, zIndex: 10 }}>
          <div className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: "rgba(20,18,43,0.65)", backdropFilter: "blur(10px)", color: "rgba(255,255,255,0.8)" }}>
            <MapPin size={11} style={{ color: "#FFB020" }} />
            {userLocation ? userLocation.fullLabel : "Detecting location…"}
            <ChevronRight size={11} style={{ opacity: 0.5 }} />
          </div>
        </div>

        {/* Rider count badge — green dot = live, no redundant 'Live' text */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2" style={{ zIndex: 10 }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(10px)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: refreshing ? "#FFB020" : "#4ADE80" }} />
            <span className="text-white font-medium" style={{ fontSize: "0.68rem" }}>
              {displayRides.length} rider{displayRides.length !== 1 ? "s" : ""} nearby
            </span>
          </div>
        </div>

        {/* Floating Search Bar — Google Places autocomplete */}
        <div className="absolute bottom-5 left-4 right-4" style={{ zIndex: 10 }}>
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
            style={{ background: "var(--card)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(20,18,43,0.18)", border: "1px solid var(--glass-border)" }}>
            <div className="flex-1 min-w-0">
              <PlacesAutocomplete
                value={searchText}
                onChange={(val) => setSearchText(val)}
                placeholder="Where are you headed?"
                pinColor="#8890A6"
                biasLat={userLocation?.lat}
                biasLng={userLocation?.lng}
              />
            </div>
            <div className="w-px h-5 shrink-0" style={{ background: "var(--border)" }} />
            <button onClick={() => setShowSearch(true)} className="relative shrink-0">
              <SlidersHorizontal size={16} style={{ color: "#2E5BFF" }} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                  style={{ fontSize: "0.55rem", background: "#2E5BFF" }}>{activeFiltersCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* QUICK DESTINATION SHORTCUTS */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] font-semibold mb-2" style={{ color: "#9297AC", letterSpacing: "0.06em" }}>WHERE TO?</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { emoji: "💼", label: "Office",   sub: "Work commute",    query: "HITEC City" },
            { emoji: "🚇", label: "Metro",    sub: "Nearest station", query: "Metro Station" },
            { emoji: "🏫", label: "College",  sub: "Campus ride",     query: "College" },
            { emoji: "🛍️", label: "Mall",     sub: "Weekend trip",    query: "Mall" },
            { emoji: "🍻", label: "Pub",      sub: "Night out",       query: "Pub" },
            { emoji: "🚉", label: "Station",  sub: "Railway",         query: "Railway Station" },
          ].map(({ emoji, label, sub, query }) => (
            <button
              key={label}
              onClick={() => setSearchText(query)}
              className="shrink-0 rounded-2xl px-3.5 py-2.5 text-left border transition-all active:scale-95 hover:border-[#2E5BFF]/30 hover:shadow-md"
              style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "0 1px 4px rgba(20,18,43,0.05)" }}
            >
              <p className="text-[17px] mb-0.5">{emoji}</p>
              <p className="text-[12px] font-semibold whitespace-nowrap" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {label}
              </p>
              <p className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "#9297AC" }}>{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* RIDES NEAR YOU */}
      <div className="px-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {userLocation ? `Rides near ${userLocation.areaName}` : "Rides near you"}
          </h2>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button onClick={() => { setFilters(DEFAULT_FILTERS); setSearchText(""); }}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <X size={11} /> Clear
              </button>
            )}
            <button onClick={() => fetchRides(true)} disabled={refreshing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--card)", color: "#2E5BFF", border: "1px solid var(--border)" }}>
              <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
        <p className="flex items-center gap-1.5 mb-3" style={{ fontSize: "0.65rem", color: "#9297AC" }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: refreshing ? "#FFB020" : "#4ADE80" }} />
          Live · {refreshLabel}
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-white font-bold" style={{ fontSize: "0.55rem", background: "#2E5BFF" }}>
              {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""}
            </span>
          )}
        </p>

        {loading ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: "#2E5BFF" }} />
            <p className="text-[13px]" style={{ color: "#9297AC" }}>Finding rides near you…</p>
          </div>
        ) : displayRides.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3 rounded-2xl border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(46,91,255,0.07)" }}>🚴</div>
            <div className="text-center px-6">
              <p className="font-bold text-[14px]" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {activeFiltersCount > 0 ? "No rides match your filters" : "No rides nearby yet"}
              </p>
              <p className="text-[12px] mt-1" style={{ color: "#9297AC" }}>
                {activeFiltersCount > 0 ? "Try adjusting or clearing your filters" : "Be the first to post a ride in your area!"}
              </p>
            </div>
            {activeFiltersCount > 0 ? (
              <button onClick={() => { setFilters(DEFAULT_FILTERS); setSearchText(""); }}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-5 py-2.5 rounded-xl"
                style={{ background: "#F3F5FB", color: "#2E5BFF", border: "1px solid rgba(46,91,255,0.2)" }}>
                <X size={13} /> Clear Filters
              </button>
            ) : (
              <button onClick={() => onRequestRide({ rider: "post" })}
                className="text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#2E5BFF,#6b8fff)", boxShadow: "0 4px 16px rgba(46,91,255,0.4)" }}>
                + Post a Ride
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayRides.map(({ ride, distKm }) => (
              <RideCard key={ride.rideId} ride={ride} distanceKm={distKm} userId={user.id} userName={user.name} onToast={showToast} />
            ))}
            {displayRides.length >= 10 && (
              <button className="w-full py-3 rounded-2xl flex items-center justify-center gap-1.5 font-medium text-[13px]"
                style={{ background: "var(--card)", color: "#2E5BFF", border: "1px solid var(--border)" }}>
                See more rides <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* SAFETY STRIP */}
      <div className="mx-4 mt-5 rounded-2xl border px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--card)", borderColor: "var(--border)", backdropFilter: "blur(4px)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,176,32,0.2)" }}>
          <Zap size={15} style={{ color: "#B87400" }} />
        </div>
        <p className="text-[11.5px] leading-snug" style={{ color: "#8A5A00" }}>
          Share your live ride with a trusted contact anytime. Tap the SOS icon during a trip for help.
        </p>
      </div>
    </div>
  );
}
