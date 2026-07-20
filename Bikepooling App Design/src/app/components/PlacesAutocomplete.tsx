/**
 * PlacesAutocomplete — Google Places-powered location input
 * Uses useMapsLibrary("places") from @vis.gl/react-google-maps
 * Must be rendered inside an <APIProvider> (already set up in App via HomeScreen).
 * If rendered outside, wraps itself in its own APIProvider.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, X, Loader2 } from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface PlacesAutocompleteInnerProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  pinColor?: string;
  id?: string;
  /** Bias suggestions toward this location */
  biasLat?: number;
  biasLng?: number;
  /** Restrict to country code, e.g. "in" */
  country?: string;
}

/** Inner component — must be inside APIProvider */
function PlacesAutocompleteInner({
  value,
  onChange,
  placeholder = "Search location…",
  pinColor = "#2E5BFF",
  id,
  biasLat,
  biasLng,
  country = "in",
}: PlacesAutocompleteInnerProps) {
  const placesLib = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialise AutocompleteService once Places library loads
  useEffect(() => {
    if (placesLib && !serviceRef.current) {
      serviceRef.current = new placesLib.AutocompleteService();
    }
  }, [placesLib]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (!serviceRef.current || input.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      const request: google.maps.places.AutocompletionRequest = {
        input,
        componentRestrictions: { country },
        types: ["geocode", "establishment"],
      };

      // Bias toward user location if available
      if (biasLat !== undefined && biasLng !== undefined) {
        request.locationBias = {
          center: { lat: biasLat, lng: biasLng },
          radius: 30000, // 30 km
        } as google.maps.places.LocationBias;
      }

      serviceRef.current.getPlacePredictions(request, (predictions, status) => {
        setLoading(false);
        if (status === "OK" && predictions) {
          setSuggestions(
            predictions.slice(0, 5).map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text ?? "",
              fullText: p.description,
            }))
          );
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      });
    },
    [biasLat, biasLng, country]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelected(false);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleSelect = (suggestion: PlaceSuggestion) => {
    onChange(suggestion.mainText, suggestion.placeId);
    setSuggestions([]);
    setOpen(false);
    setSelected(true);
  };

  const handleClear = () => {
    onChange("");
    setSuggestions([]);
    setOpen(false);
    setSelected(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="flex items-center gap-2">
        <MapPin size={16} style={{ color: pinColor, flexShrink: 0 }} />
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          style={{ fontSize: "0.9rem" }}
        />
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#9297AC" }} />}
        {value && !loading && (
          <button type="button" onClick={handleClear} className="shrink-0">
            <X size={14} style={{ color: "#9297AC" }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 z-50 rounded-2xl overflow-hidden mt-2 py-1"
          style={{
            background: "var(--card, white)",
            boxShadow: "0 8px 32px rgba(20,18,43,0.16), 0 2px 8px rgba(20,18,43,0.08)",
            border: "1px solid var(--border, #E7E9F2)",
            top: "calc(100% + 4px)",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all hover:bg-[rgba(46,91,255,0.06)] active:bg-[rgba(46,91,255,0.10)]"
              style={{ borderBottom: i < suggestions.length - 1 ? "1px solid var(--border, #F3F5FB)" : "none" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(46,91,255,0.08)" }}
              >
                <MapPin size={13} style={{ color: pinColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-semibold truncate"
                  style={{ color: "var(--foreground, #14122B)", fontFamily: "'Space Grotesk', sans-serif" }}
                >
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
      )}
    </div>
  );
}

/** Public component — wraps in APIProvider if needed */
export function PlacesAutocomplete(props: PlacesAutocompleteInnerProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY}>
      <PlacesAutocompleteInner {...props} />
    </APIProvider>
  );
}
