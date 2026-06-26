import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import SpeciesCard from "./SpeciesCard";

const baseStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function App() {
  const mapRef = useRef(null);
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);

  const [distMode, setDistMode] = useState("gbif"); // "gbif" | "heatmap" | "points"
  const [activeSpecies, setActiveSpecies] = useState(null); // remember the last-selected fish

  const renderTokenRef = useRef(0);
  const activeSpeciesRef = useRef(null);

  const [distLoading, setDistLoading] = useState(false);


  // Initialize the map once on mount, and set up all event handlers.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: "map",
      style: baseStyle,
      // Zoomed out to show the whole world
      center: [0, 20],
      zoom: 1.5,
    });
    mapRef.current = map;


  




    // --- shared: run the area search for any box, given its WKT + GeoJSON ---
    // (used by both single-click and space-drag selection)
    const runAreaSearch = async (wkt, boxGeoJSON) => {
      // draw / move the highlight box
      if (map.getSource("search-box")) {
        map.getSource("search-box").setData(boxGeoJSON);
      } else {
        map.addSource("search-box", { type: "geojson", data: boxGeoJSON });
        map.addLayer({
          id: "search-box-fill", type: "fill", source: "search-box",
          paint: { "fill-color": "#1a73e8", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "search-box-line", type: "line", source: "search-box",
          paint: { "line-color": "#1a73e8", "line-width": 2 },
        });
      }

      setLoading(true);
      setSpecies([]);
      try {
        const r = await fetch(`/api/fish-in-area?wkt=${encodeURIComponent(wkt)}`);
        if (!r.ok) throw new Error("Failed to load species");
        const list = await r.json();        
        setSpecies(list.map((s) => ({ ...s, imageStatus: "loading" })));
        setLoading(false);
        list.forEach(async (sp) => {
          try {
            const ir = await fetch(`/api/species-image?speciesKey=${sp.speciesKey}`);
            if (!ir.ok) throw new Error("Failed to load image");           
            const { image } = await ir.json();
            setSpecies((prev) =>
              prev.map((s) =>
                s.speciesKey === sp.speciesKey ? { ...s, image, imageStatus: "done" } : s
              )
            );
          } catch {
            setSpecies((prev) =>
              prev.map((s) =>
                s.speciesKey === sp.speciesKey ? { ...s, imageStatus: "done" } : s
              )
            );
          }
        });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    // helper: build a rectangle's WKT + GeoJSON from two opposite corners
    const boxFromCorners = (a, b) => {
      const minLng = Math.min(a.lng, b.lng), maxLng = Math.max(a.lng, b.lng);
      const minLat = Math.min(a.lat, b.lat), maxLat = Math.max(a.lat, b.lat);
      // counter-clockwise ring for GBIF
      const ring = [
        [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat],
      ];
      const wkt = `POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
      const geo = { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] } };
      return { wkt, geo };
    };

    // --- space-drag selection state ---
    let spaceHeld = false;
    let dragStart = null;   // {lng, lat} where the drag began

    const onKeyDown = (ev) => {
      if (ev.target.tagName === "INPUT") return;
      if (ev.code === "Space" && !spaceHeld) {
        spaceHeld = true;
        map.dragPan.disable();                       // stop the map from panning
        map.getCanvas().style.cursor = "crosshair";  // visual cue
        ev.preventDefault();                          // don't scroll the page
      }
    };
    const onKeyUp = (ev) => {
      if (ev.code === "Space") {
        spaceHeld = false;
        dragStart = null;
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
      }
    };

    map.on("mousedown", (e) => {
      if (!spaceHeld) return;          // normal click handled elsewhere
      dragStart = e.lngLat;
    });

    map.on("mousemove", (e) => {
      if (!spaceHeld || !dragStart) return;
      // live-preview the rectangle as the mouse moves
      const { geo } = boxFromCorners(dragStart, e.lngLat);
      if (map.getSource("search-box")) {
        map.getSource("search-box").setData(geo);
      } else {
        map.addSource("search-box", { type: "geojson", data: geo });
        map.addLayer({
          id: "search-box-fill", type: "fill", source: "search-box",
          paint: { "fill-color": "#1a73e8", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "search-box-line", type: "line", source: "search-box",
          paint: { "line-color": "#1a73e8", "line-width": 2 },
        });
      }
    });

    map.on("mouseup", (e) => {
      if (!spaceHeld || !dragStart) return;
      const { wkt, geo } = boxFromCorners(dragStart, e.lngLat);
      dragStart = null;
      // ignore a tiny accidental drag (basically a click)
      const tiny = Math.abs(e.lngLat.lng - geo.geometry.coordinates[0][0][0]) < 0.001;
      if (!tiny) runAreaSearch(wkt, geo);
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);







    map.on("click", async (e) => {
      if (spaceHeld) return;  // space-drag handles its own selection
      const { lng, lat } = e.lngLat;
      const d = 0.5;
      const { wkt, geo } = boxFromCorners(
        { lng: lng - d, lat: lat - d },
        { lng: lng + d, lat: lat + d }
      );
      runAreaSearch(wkt, geo);
    });









    const handleKey = (ev) => {
      if (ev.target.tagName === "INPUT") return;

      if (ev.key === "r" || ev.key === "R") {
        map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
      }

      if (ev.key === "Escape") {
        // Step 1: if a distribution is showing, clear just that first
        if (activeSpeciesRef.current) {
          clearDistribution();
          setActiveSpecies(null);
          setQuery("");
          setDistLoading(false);   // ← reset indicator
        } else {
          // Step 2: no distribution → clear the search box + sidebar
          if (map.getLayer("search-box-fill")) map.removeLayer("search-box-fill");
          if (map.getLayer("search-box-line")) map.removeLayer("search-box-line");
          if (map.getSource("search-box")) map.removeSource("search-box");
          setSpecies([]);
        }
      }
    };



    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", handleKey);
      map.remove();
    };

  }, []); //end useeffect



  // keep the ref in sync with activeSpecies (for use inside event handlers)
  useEffect(() => {
    activeSpeciesRef.current = activeSpecies;
  }, [activeSpecies]);






  function onQueryChange(value) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/species-suggest?q=${encodeURIComponent(value)}`);
        if (!r.ok) throw new Error("Search failed");
        const list = await r.json();
        setSuggestions(list.map((s) => ({ ...s, imageStatus: "loading" })));
        list.forEach(async (sp) => {
          try {
            const ir = await fetch(`/api/species-image?speciesKey=${sp.key}`);
            if (!ir.ok) throw new Error("Failed to load image");
            const { image } = await ir.json();
            setSuggestions((prev) =>
              prev.map((s) => (s.key === sp.key ? { ...s, image, imageStatus: "done" } : s))
            );
          } catch {
            setSuggestions((prev) =>
              prev.map((s) => (s.key === sp.key ? { ...s, imageStatus: "done" } : s))
            );
          }
        });
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }











  // Selecting a species builds ALL distribution layers once, then shows the active mode.
  async function selectSpecies(sp, fillSearch = true) {
    if (fillSearch) setQuery(sp.commonName || sp.scientificName);
    setSuggestions([]);
    setActiveSpecies(sp);
    await buildDistributionLayers(sp);  // build everything once
    showMode(distMode);                 // reveal only the active one
  }





  // Remove all distribution layers + sources (used when switching species)
  function clearDistribution() {
    const map = mapRef.current;
    if (!map) return;
    const layerIds = ["dist-gbif", "dist-points", "dist-heatmap"];
    const sourceIds = ["dist-gbif", "dist-points", "dist-heatmap"];
    for (const id of layerIds) {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
    }
    for (const id of sourceIds) {
      try { if (map.getSource(id)) map.removeSource(id); } catch {}
    }
  }


  // Build all three layers for a species, all starting hidden.
  async function buildDistributionLayers(sp) {
    const map = mapRef.current;
    clearDistribution();
    if (!sp) { setDistLoading(false); return; }

    const myToken = ++renderTokenRef.current;
    setDistLoading(true);   // ← start loading

    // --- GBIF raster (instant, no fetch) ---
    map.addSource("dist-gbif", {
      type: "raster",
      tiles: [
        `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${sp.key}&bin=hex&hexPerTile=30&style=classic.poly`,
      ],
      tileSize: 512,
    });
    map.addLayer({
      id: "dist-gbif", type: "raster", source: "dist-gbif",
      layout: { visibility: "none" },
    });

    // --- fetch raw points (heatmap + points need them) ---
    const r = await fetch(`/api/species-points?taxonKey=${sp.key}`);
    if (!r.ok) { setDistLoading(false); return; }
    const points = await r.json();
    if (myToken !== renderTokenRef.current) return; // newer species picked; leave loading to that build
    setDistLoading(false);  // ← done loading
    if (!points.length) return;







    // POINTS layer
    map.addSource("dist-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: p },
        })),
      },
    });
    map.addLayer({
      id: "dist-points",
      type: "circle",
      source: "dist-points",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 4,
        "circle-color": "#e8590c",
        "circle-opacity": 0.7,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff",
      },
    });


    // HEATMAP mode → MapLibre native heatmap (smooth density gradient)
    map.addSource("dist-heatmap", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: p },
        })),
      },
    });
    map.addLayer({
      id: "dist-heatmap",
      type: "heatmap",
      source: "dist-heatmap",
      layout: { visibility: "none" },
      paint: {
        // density-driven color ramp: transparent → blue → red core
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0,   "rgba(0,0,0,0)",
          0.2, "rgba(0,120,255,0.5)",
          0.4, "rgba(0,255,200,0.6)",
          0.6, "rgba(255,230,0,0.7)",
          0.8, "rgba(255,120,0,0.8)",
          1,   "rgba(210,0,0,0.9)",
        ],
        "heatmap-radius": [
          "interpolate", ["linear"], ["zoom"],
          1, 8,
          6, 25,
        ],
        "heatmap-weight": 1,
        "heatmap-intensity": [
          "interpolate", ["linear"], ["zoom"],
          1, 0.6,
          6, 1.5,
        ],
        "heatmap-opacity": 0.85,
      },
    });

    // now that everything's built, reveal whatever mode is currently selected
    showMode(distMode);
  }










  // Show only the chosen mode's layers, hide the rest. No fetching, no rebuilding.
  function showMode(mode) {
    const map = mapRef.current;
    if (!map) return;
    const vis = (id, on) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    vis("dist-gbif", mode === "gbif");
    vis("dist-points", mode === "points");
    vis("dist-heatmap", mode === "heatmap");
  }

  // Toggling a mode is now instant — just change visibility.
  function changeMode(mode) {
    setDistMode(mode);
    showMode(mode);
  }














  

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", fontFamily: "inherit" }}>
      <div style={{ flex: 1, height: "100%", position: "relative" }}>
        <div id="map" style={{ width: "100%", height: "100%" }} />


        {/* distribution mode toggle, top-right of the map */}
        <div
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 1,
            display: "flex", background: "#fff", borderRadius: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)", overflow: "hidden",
          }}
        >
          {[
            { id: "gbif", label: "GBIF" },
            { id: "heatmap", label: "Heatmap" },
            { id: "points", label: "Points" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              style={{
                padding: "8px 16px", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: distMode === m.id ? "#1a73e8" : "transparent",
                color: distMode === m.id ? "#fff" : "#444",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Step 4: loading badge goes here */}
        {distLoading && (
          <div
            style={{
              position: "absolute", top: 58, right: 12, zIndex: 1,
              background: "#fff", borderRadius: 18, padding: "6px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              fontSize: 13, color: "#444", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span
              style={{
                width: 12, height: 12, border: "2px solid #ddd",
                borderTopColor: "#1a73e8", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.7s linear infinite",
              }}
            />
            Loading distribution…
          </div>
        )}


        {activeSpecies && (
          <div
            style={{
              position: "absolute", bottom: 24, left: 12, zIndex: 1,
              background: "#fff", borderRadius: 12, padding: "8px 14px 8px 8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              display: "flex", alignItems: "center", gap: 10, maxWidth: 320,
            }}
          >
            {activeSpecies.image && /^https:\/\//i.test(activeSpecies.image) ? (
              <img
                src={activeSpecies.image}
                alt={activeSpecies.scientificName}
                style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                  background: "#f0f0f0", color: "#999", fontSize: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textAlign: "center", padding: 3, lineHeight: 1.1,
                }}
              >
                No Image
              </div>
            )}
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "#70757a", marginBottom: 1 }}>Showing</div>
              <div
                style={{
                  fontSize: 14, fontWeight: 600, color: "#202124",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {activeSpecies.commonName || activeSpecies.scientificName}
              </div>
            </div>
          </div>
        )}







        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 1, width: 300 }}>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions.length > 0) selectSpecies(suggestions[0]);
              if (e.key === "Escape") setSuggestions([]);
            }}
            placeholder="Search a fish…"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 24,
              border: "none",
              background: "#fff",
              color: "#222",
              fontSize: 15,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              outline: "none",
            }}
          />

          {suggestions.length > 0 && (
            <div
              style={{
                marginTop: 6,
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                overflow: "hidden",
              }}
            >
              {suggestions.map((sp) => (
                <div
                  key={sp.key}
                  onClick={() => selectSpecies(sp)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f3f3")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <SpeciesCard
                    image={sp.image}
                    imageStatus={sp.imageStatus}
                    commonName={sp.commonName}
                    scientificName={sp.scientificName}
                    size="small"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside
        style={{
          width: 360,
          flexShrink: 0,
          height: "100%",
          overflowY: "auto",
          background: "#fff",
          color: "#202124",
          borderLeft: "1px solid #e4e4e7",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "#fff",
            padding: "20px 20px 14px",
            borderBottom: "1px solid #e4e4e7",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/favicon.svg"
              alt="Brilliant Blue logo"
              style={{ width: 28, height: 28, flexShrink: 0 }}
            />
            <h2 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: "#202124",
              fontFamily: "'Playfair Display', serif",
            }}>
              Brilliant Blue
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#70757a" }}>
            Aquatic GBIF species explorer and visualizer.
          </p>
        </div>

        <div style={{ padding: "12px 14px" }}>
          {loading && <p style={{ color: "#70757a", fontSize: 14, padding: "8px 6px" }}>Loading…</p>}
          {!loading && species.length === 0 && (
            <p style={{ color: "#9aa0a6", fontSize: 14, padding: "8px 6px" }}>
              Click on the map or drag a box (hold spacebar) to search for aquatic species in that area.
            </p>
          )}


          {species.map((s) => {
            const isActive = activeSpecies && activeSpecies.key === s.speciesKey;
            return (
              <div
                key={s.speciesKey}
                onClick={() =>
                  selectSpecies(
                    {
                      key: s.speciesKey,
                      commonName: s.commonName,
                      scientificName: s.scientificName,
                      image: s.image,          // ← pass the image too
                    },
                    false
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 8px",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  background: isActive ? "#e8f0fe" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f4")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isActive ? "#e8f0fe" : "transparent")
                }
              >
                <SpeciesCard
                  image={s.image}
                  imageStatus={s.imageStatus}
                  commonName={s.commonName}
                  scientificName={s.scientificName}
                  size="large"
                />
              </div>
            );
          })}


        </div>
      </aside>
    </div>
  );
}