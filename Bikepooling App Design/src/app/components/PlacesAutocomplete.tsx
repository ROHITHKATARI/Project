/**
 * PlacesAutocomplete — Platform-aware location search
 *
 * Android: Uses OpenStreetMap Nominatim API (no API key, no referrer restrictions)
 * Web:     Uses Google Places AutocompleteService (requires Maps JS API loaded)
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

const IS_NATIVE = Capacitor.isNativePlatform();
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

interface PlaceSuggestion {
  id: string;
  mainText: string;
  secondaryText: string;
}

export interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  pinColor?: string;
  id?: string;
  biasLat?: number;
  biasLng?: number;
}

// ─── Shared Dropdown UI ───────────────────────────────────────────────────────
function SuggestionDropdown({
  suggestions,
  pinColor,
  onSelect,
}: {
  suggestions: PlaceSuggestion[];
  pinColor: string;
  onSelect: (s: PlaceSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div
      className="absolute left-0 right-0 z-[200] rounded-2xl overflow-hidden py-1"
      style={{
        background: "var(--card, white)",
        boxShadow: "0 8px 32px rgba(20,18,43,0.16)",
        border: "1px solid var(--border, #E7E9F2)",
        top: "calc(100% + 4px)",
      }}
    >
      {suggestions.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onSelect(s); }}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
          className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all hover:bg-[rgba(46,91,255,0.06)] active:bg-[rgba(46,91,255,0.10)]"
          style={{ borderBottom: i < suggestions.length - 1 ? "1px solid var(--border, #F3F5FB)" : "none" }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(46,91,255,0.08)" }}>
            <MapPin size={13} style={{ color: pinColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate"
              style={{ color: "var(--foreground, #14122B)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {s.mainText}
            </p>
            {s.secondaryText && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--muted-foreground, #9297AC)" }}>
                {s.secondaryText}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Nominatim search (Android) ───────────────────────────────────────────────
async function searchNominatim(
  query: string,
  lat?: number,
  lng?: number
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "6",
    addressdetails: "1",
    countrycodes: "in",
  });
  if (lat !== undefined && lng !== undefined) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
    params.set("viewbox", `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`);
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": "DostWheels/1.0", "Accept-Language": "en" } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    address: Record<string, string>;
    name?: string;
  }>;
  return data.map((item) => {
    const addr = item.address ?? {};
    const mainText =
      item.name ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      item.display_name.split(",")[0];
    const parts = item.display_name.split(",").slice(1, 4).join(",").trim();
    return { id: String(item.place_id), mainText: mainText ?? "", secondaryText: parts };
  });
}

// ─── Nominatim Autocomplete Component (Android) ───────────────────────────────
function NominatimAutocomplete({
  value, onChange, placeholder = "Search location…", pinColor = "#2E5BFF", id, biasLat, biasLng,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
      setLoading(true);
      try {
        const results = await searchNominatim(q, biasLat, biasLng);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    },
    [biasLat, biasLng]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 400);
  };

  const handleSelect = (s: PlaceSuggestion) => {
    onChange(s.mainText, s.id);
    setSuggestions([]); setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <MapPin size={16} style={{ color: pinColor, flexShrink: 0 }} />
        <input
          id={id} type="text" value={value} onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder} autoComplete="off" autoCorrect="off" spellCheck={false}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          style={{ fontSize: "0.9rem", color: "var(--foreground)" }}
        />
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#9297AC" }} />}
        {value && !loading && (
          <button type="button" onClick={() => { onChange(""); setSuggestions([]); setOpen(false); }} className="shrink-0">
            <X size={14} style={{ color: "#9297AC" }} />
          </button>
        )}
      </div>
      {open && (
        <SuggestionDropdown suggestions={suggestions} pinColor={pinColor} onSelect={handleSelect} />
      )}
    </div>
  );
}

// ─── Google Places Autocomplete (Web, inside APIProvider) ─────────────────────
function GooglePlacesInner({
  value, onChange, placeholder = "Search location…", pinColor = "#2E5BFF", id, biasLat, biasLng,
}: PlacesAutocompleteProps) {
  const placesLib = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!placesLib) return;
    serviceRef.current = new placesLib.AutocompleteService();
    if (placesLib.AutocompleteSessionToken) tokenRef.current = new placesLib.AutocompleteSessionToken();
  }, [placesLib]);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const fetchSuggestions = useCallback((q: string) => {
    if (!serviceRef.current || q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    const req: google.maps.places.AutocompletionRequest = {
      input: q,
      componentRestrictions: { country: "in" },
      types: ["geocode", "establishment"],
      ...(tokenRef.current ? { sessionToken: tokenRef.current } : {}),
      ...(biasLat !== undefined && biasLng !== undefined
        ? { locationBias: { center: { lat: biasLat, lng: biasLng }, radius: 30000 } as google.maps.places.LocationBias }
        : {}),
    };
    serviceRef.current.getPlacePredictions(req, (predictions, status) => {
      setLoading(false);
      if (status === "OK" && predictions?.length) {
        setSuggestions(predictions.slice(0, 5).map((p) => ({
          id: p.place_id,
          mainText: p.structured_formatting?.main_text ?? p.description,
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        })));
        setOpen(true);
      } else { setSuggestions([]); setOpen(false); }
    });
  }, [biasLat, biasLng]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (s: PlaceSuggestion) => {
    onChange(s.mainText, s.id);
    setSuggestions([]); setOpen(false);
    if (placesLib?.AutocompleteSessionToken) tokenRef.current = new placesLib.AutocompleteSessionToken();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <MapPin size={16} style={{ color: pinColor, flexShrink: 0 }} />
        <input
          id={id} type="text" value={value} onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder} autoComplete="off" spellCheck={false}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          style={{ fontSize: "0.9rem", color: "var(--foreground)" }}
        />
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#9297AC" }} />}
        {value && !loading && (
          <button type="button" onClick={() => { onChange(""); setSuggestions([]); setOpen(false); }} className="shrink-0">
            <X size={14} style={{ color: "#9297AC" }} />
          </button>
        )}
      </div>
      {open && (
        <SuggestionDropdown suggestions={suggestions} pinColor={pinColor} onSelect={handleSelect} />
      )}
    </div>
  );
}

function GooglePlacesAutocomplete(props: PlacesAutocompleteProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={["places"]}>
      <GooglePlacesInner {...props} />
    </APIProvider>
  );
}

// ─── Public export — platform-aware ─────────────────────────────────────────
export function PlacesAutocomplete(props: PlacesAutocompleteProps) {
  return IS_NATIVE
    ? <NominatimAutocomplete {...props} />
    : <GooglePlacesAutocomplete {...props} />;
}
