'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import './SafetyMap.css';

/* ═══════════════════════════════════════
   PREDEFINED DATA
   ═══════════════════════════════════════ */

const ISOLATED_ZONES = [
  { lat: 28.52, lng: 77.05, radius: 4 },  // Dwarka outskirts
  { lat: 28.70, lng: 77.32, radius: 3.5 }, // Yamuna floodplain
  { lat: 28.58, lng: 77.38, radius: 3 },   // Noida industrial belt
  { lat: 28.75, lng: 77.10, radius: 3 },   // Rohini edge
  { lat: 28.48, lng: 77.22, radius: 3.5 }, // Mehrauli forests
  { lat: 28.65, lng: 77.45, radius: 3 },   // Ghaziabad fringe
  { lat: 28.45, lng: 77.52, radius: 3 },   // Greater Noida outskirts
  { lat: 28.50, lng: 77.58, radius: 2.5 }, // Eastern peripheral edge
];

const POLICE_STATIONS = [
  { lat: 28.6328, lng: 77.2197, name: 'Connaught Place PS' },
  { lat: 28.6562, lng: 77.2410, name: 'Civil Lines PS' },
  { lat: 28.5921, lng: 77.2090, name: 'Lodhi Colony PS' },
  { lat: 28.5355, lng: 77.2507, name: 'Defence Colony PS' },
  { lat: 28.4670, lng: 77.5134, name: 'Knowledge Park PS' },
  { lat: 28.4735, lng: 77.5020, name: 'Pari Chowk PS' },
  { lat: 28.4901, lng: 77.4852, name: 'Alpha 2 PS' },
];

const COMMERCIAL_ZONES = [
  { lat: 28.6315, lng: 77.2167, radius: 1.5, name: 'Connaught Place' },
  { lat: 28.5672, lng: 77.2438, radius: 1.2, name: 'Lajpat Nagar' },
  { lat: 28.5244, lng: 77.1855, radius: 1.5, name: 'Saket Mall District' },
  { lat: 28.4720, lng: 77.5065, radius: 1.2, name: 'Pari Chowk Commercial Hub' },
  { lat: 28.4590, lng: 77.4980, name: 'Grand Venice Mall Area', radius: 1.0 },
  { lat: 28.4850, lng: 77.5100, name: 'Alpha 1 Market', radius: 0.8 },
];

/* ═══════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════ */

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateSafetyScore(lat: number, lng: number, forceNight: boolean): number {
  let score = 5;

  // 1. Time factor
  const hour = new Date().getHours();
  if (forceNight || hour >= 20 || hour < 6) {
    score -= 2;
  }

  // 2. Micro-location Noise (Simulates local terrain/lighting/activity variety)
  // Deterministic variation based on coordinates so the same spot always has the same score
  const noise = (Math.sin(lat * 1000) + Math.cos(lng * 1000)) * 1.5;
  score += noise;

  // 3. Isolation factor
  for (const zone of ISOLATED_ZONES) {
    if (haversineDistance(lat, lng, zone.lat, zone.lng) <= zone.radius) {
      score -= 2.5; 
      break;
    }
  }

  // 4. Police proximity factor
  for (const station of POLICE_STATIONS) {
    if (haversineDistance(lat, lng, station.lat, station.lng) <= 1.2) {
      score += 2.5;
      break;
    }
  }

  // 5. Commercial area factor
  for (const zone of COMMERCIAL_ZONES) {
    if (haversineDistance(lat, lng, zone.lat, zone.lng) <= zone.radius) {
      score += 1.5;
      break;
    }
  }

  // 6. Center distance factor (Greater Noida vs Delhi centers)
  const distToNoidaCenter = haversineDistance(lat, lng, 28.4735, 77.5020);
  if (distToNoidaCenter < 2) score += 1;

  return Math.round(Math.max(0, Math.min(10, score)));
}

function getScoreColor(score: number): string {
  if (score >= 7) return '#22c55e';
  if (score >= 4) return '#facc15';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 7) return 'Safe';
  if (score >= 4) return 'Moderate';
  return 'Caution';
}

function getScoreBadgeClass(score: number): string {
  if (score >= 7) return 'safe';
  if (score >= 4) return 'moderate';
  return 'caution';
}

function getZoneTip(score: number, name: string): string {
  if (score >= 7) return `Well-lit area near ${name} with high foot traffic and police presence.`;
  if (score >= 4) return `Moderate activity in ${name}. Stay alert, especially after dark.`;
  return `Low foot traffic near ${name}. Avoid walking alone at night.`;
}

/* ═══════════════════════════════════════
   BUILD ZONE GRID
   ═══════════════════════════════════════ */

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E'];
const COL_LABELS = ['1', '2', '3', '4', '5'];

function buildZoneGrid() {
  const zones: Array<{
    lat: number;
    lng: number;
    name: string;
  }> = [];
  const baseLat = 28.61;
  const baseLng = 77.23;
  const spacing = 0.07;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const lat = baseLat + (r - 2) * spacing;
      const lng = baseLng + (c - 2) * spacing;
      zones.push({
        lat,
        lng,
        name: `Zone ${ROW_LABELS[r]}${COL_LABELS[c]}`,
      });
    }
  }
  return zones;
}

const ZONE_GRID = buildZoneGrid();

/* ═══════════════════════════════════════
   TILE URLS
   ═══════════════════════════════════════ */

const DAY_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const NIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/* ═══════════════════════════════════════
   POPUP HTML BUILDER
   ═══════════════════════════════════════ */

function buildPopupHtml(name: string, score: number): string {
  const label = getScoreLabel(score);
  const badgeCls = getScoreBadgeClass(score);
  const color = getScoreColor(score);
  const tip = getZoneTip(score, name);
  const pct = (score / 10) * 100;

  return `
    <div class="popup-card">
      <div class="popup-card-header">
        <span class="popup-zone-name">${name}</span>
        <span class="popup-badge popup-badge-${badgeCls}">${label}</span>
      </div>
      <div class="popup-score">
        <span class="popup-score-label">Safety Score</span>
        <span class="popup-score-value">${score}/10</span>
        <div class="popup-score-bar">
          <div class="popup-score-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
      <div class="popup-tip">
        <span class="popup-tip-icon">💡</span>${tip}
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════ */

export default function SafetyMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleLayersRef = useRef<any[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [followMe, setFollowMe] = useState(true);
  const [disclaimerVisible, setDisclaimerVisible] = useState(true);

  // Routing State
  const [sourceQuery, setSourceQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [sourcePoint, setSourcePoint] = useState<any>(null);
  const [destPoint, setDestPoint] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeReport, setRouteReport] = useState<any>(null);
  const routingControlRef = useRef<any>(null);

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userScore, setUserScore] = useState<number | null>(null);

  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedMarkerRef, setSelectedMarkerRef] = useState<any>(null);

  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');

  // Refs for state values needed in callbacks
  const followMeRef = useRef(followMe);
  const nightModeRef = useRef(nightMode);

  useEffect(() => {
    followMeRef.current = followMe;
    if (followMe) {
      setSelectedLat(null);
      setSelectedLng(null);
      setSelectedScore(null);
      if (selectedMarkerRef && mapRef.current) {
        mapRef.current.removeLayer(selectedMarkerRef);
        setSelectedMarkerRef(null);
      }
    }
  }, [followMe, selectedMarkerRef]);

  useEffect(() => {
    nightModeRef.current = nightMode;
  }, [nightMode]);

  /* ── Inject Leaflet CSS + JS, then init map ── */
  useEffect(() => {
    let cancelled = false;

    function loadResource(tag: 'link' | 'script', attrs: Record<string, string>): Promise<void> {
      return new Promise((resolve, reject) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`Failed to load ${attrs.href || attrs.src}`));
        document.head.appendChild(el);
      });
    }

    async function init() {
      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        await loadResource('link', {
          rel: 'stylesheet',
          href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        });
      }

      // Load Routing Machine CSS
      if (!document.querySelector('link[href*="routing-machine"]')) {
        await loadResource('link', {
          rel: 'stylesheet',
          href: 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css',
        });
      }

      // Load Leaflet JS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).L) {
        await loadResource('script', {
          src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        });
      }

      // Load Routing Machine JS
      if (!(window as any).L?.Routing) {
        await loadResource('script', {
          src: 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js',
        });
      }

      if (cancelled || !mapContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;

      // Avoid double-init
      if (mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [28.61, 77.23],
        zoom: 13,
        zoomControl: true,
      });

      mapRef.current = map;

      tileLayerRef.current = L.tileLayer(DAY_TILES, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Render zone circles
      renderZoneCircles(L, map, false);

      // Render police station markers
      for (const station of POLICE_STATIONS) {
        const policeIcon = L.divIcon({
          className: '',
          html: '<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🚔</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([station.lat, station.lng], { icon: policeIcon })
          .addTo(map)
          .bindPopup(
            `<div class="popup-card"><div class="popup-zone-name">${station.name}</div><div class="popup-tip" style="border:none;padding-top:4px">Police station — safer proximity zone (+2 to score within 1 km)</div></div>`
          );
      }

      // Map click listener for scoring
      map.on('click', (e: any) => {
        if (followMeRef.current) return;

        const { lat, lng } = e.latlng;
        const score = calculateSafetyScore(lat, lng, nightModeRef.current);

        setSelectedLat(lat);
        setSelectedLng(lng);
        setSelectedScore(score);

        // Update selected marker
        if (userMarkerRef.current) { // We'll keep the user marker but show another one if needed or just use a popup
          // Actually let's use a temporary search marker
          L.popup()
            .setLatLng([lat, lng])
            .setContent(buildPopupHtml("Selected Location", score))
            .openOn(map);
        }
      });

      setIsLoading(false);

      // Delay a tick so Leaflet can measure the container
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Render / re-render zone circles ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderZoneCircles = useCallback((L: any, map: any, isNight: boolean) => {
    // Remove old
    for (const layer of circleLayersRef.current) {
      map.removeLayer(layer);
    }
    circleLayersRef.current = [];

    for (const zone of ZONE_GRID) {
      const score = calculateSafetyScore(zone.lat, zone.lng, isNight);
      const color = getScoreColor(score);
      const radius = 600 + ((zone.lat * 1000 + zone.lng * 1000) % 300); // 600-900m deterministic

      const circle = L.circle([zone.lat, zone.lng], {
        radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 1,
        opacity: 0.5,
      })
        .addTo(map)
        .bindPopup(buildPopupHtml(zone.name, score));

      circleLayersRef.current.push(circle);
    }
  }, []);

  /* ── Night mode toggle handler ── */
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const map = mapRef.current;

    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(nightMode ? NIGHT_TILES : DAY_TILES, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    renderZoneCircles(L, map, nightMode);

    // Recalculate user score
    if (userLat !== null && userLng !== null) {
      setUserScore(calculateSafetyScore(userLat, userLng, nightMode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightMode, renderZoneCircles]);

  /* ── Live geolocation tracking ── */
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Wait for map to be ready
    const waitForMap = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (!L || !mapRef.current) return;
      clearInterval(waitForMap);

      const map = mapRef.current;

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          setUserLat(lat);
          setUserLng(lng);
          setUserScore(calculateSafetyScore(lat, lng, nightMode));
          setLastUpdated(
            new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );

          // User marker
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const userIcon = L.divIcon({
              className: '',
              html: '<div class="user-marker-dot"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            userMarkerRef.current = L.marker([lat, lng], {
              icon: userIcon,
              zIndexOffset: 1000,
            }).addTo(map);
          }

          // Follow
          if (followMe) {
            map.panTo([lat, lng], { animate: true, duration: 0.5 });
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );

      watchIdRef.current = watchId;
    }, 200);

    return () => {
      clearInterval(waitForMap);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Route Safety Analysis Logic ── */
  const analyzeRouteSafety = useCallback((coordinates: any[]) => {
    if (!coordinates || coordinates.length === 0) return;

    // Sample points (every ~500m or every Nth point for performance)
    const sampleRate = Math.max(1, Math.floor(coordinates.length / 15));
    const sampledPoints = coordinates.filter((_, idx) => idx % sampleRate === 0);
    
    let totalScore = 0;
    let cautionSegments = 0;

    sampledPoints.forEach((pt) => {
      const score = calculateSafetyScore(pt.lat, pt.lng, nightModeRef.current);
      totalScore += score;
      if (score < 4) cautionSegments++;
    });

    const avgScore = Math.round(totalScore / sampledPoints.length);
    setRouteReport({
      score: avgScore,
      cautionSegments,
      totalPoints: sampledPoints.length,
      status: avgScore >= 7 ? 'Safe' : avgScore >= 4 ? 'Moderate' : 'Caution'
    });
  }, []);

  const handleSearch = async (query: string, setSuggestions: (s: any[]) => void) => {
    if (query.length < 3) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&bounded=1&viewbox=77.0,28.4,77.6,28.8`);
      const data = await res.json();
      setSuggestions(data);
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  };

  const clearRoute = () => {
    if (routingControlRef.current && mapRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    setSourcePoint(null);
    setDestPoint(null);
    setSourceQuery('');
    setDestQuery('');
    setRouteReport(null);
  };

  const calculateRoute = () => {
    if (!sourcePoint || !destPoint || !mapRef.current) return;
    
    const L = (window as any).L;
    const map = mapRef.current;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    setIsRouting(true);

    const control = L.Routing.control({
      waypoints: [
        L.latLng(sourcePoint.lat, sourcePoint.lon),
        L.latLng(destPoint.lat, destPoint.lon)
      ],
      routeWhileDragging: false,
      draggableWaypoints: false,
      addWaypoints: false,
      createMarker: () => null, // We'll use our own or none
      lineOptions: {
        styles: [{ color: '#d4af37', opacity: 0.8, weight: 6 }]
      }
    })
    .on('routesfound', (e: any) => {
      setIsRouting(false);
      const routes = e.routes;
      const coordinates = routes[0].coordinates;
      analyzeRouteSafety(coordinates);
    })
    .on('routingerror', () => {
      setIsRouting(false);
      alert('Could not find a valid route between these points.');
    })
    .addTo(map);

    routingControlRef.current = control;
    setFollowMe(false); // Stop following user while viewing route
  };

  /* ── Follow-me toggling ── */
  useEffect(() => {
    if (followMe && userLat !== null && userLng !== null && mapRef.current) {
      mapRef.current.panTo([userLat, userLng], { animate: true, duration: 0.5 });
    }
  }, [followMe, userLat, userLng]);

  /* ── Recalculate user score when nightMode changes and we have coords ── */
  useEffect(() => {
    if (userLat !== null && userLng !== null) {
      setUserScore(calculateSafetyScore(userLat, userLng, nightMode));
    }
  }, [nightMode, userLat, userLng]);

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  return (
    <div className="safety-map-page">
      {/* Loading overlay */}
      <div className={`map-loading ${!isLoading ? 'map-loading-hidden' : ''}`}>
        <div className="map-loading-spinner" />
        <span className="map-loading-text">Loading Safety Map…</span>
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="safety-map-container"
        style={{ width: '100%', height: '100vh' }}
      />

      {/* Back button */}
      <a href="/dashboard" className="map-back-btn">
        ← Dashboard
      </a>

      {/* Disclaimer */}
      {disclaimerVisible && (
        <div className="map-disclaimer">
          <span className="map-disclaimer-icon">⚠️</span>
          <span className="map-disclaimer-text">
            This safety indication is based on estimated environmental factors and not real-time
            data. Always trust your instincts and contact emergency services if needed.
          </span>
          <button
            className="map-disclaimer-close"
            onClick={() => setDisclaimerVisible(false)}
            aria-label="Dismiss disclaimer"
          >
            ×
          </button>
        </div>
      )}

      {/* Controls (top right) */}
      <div className="map-controls">
        {/* Night mode toggle */}
        <button
          className={`map-control-btn ${nightMode ? 'map-control-btn-active' : ''}`}
          onClick={() => setNightMode((prev) => !prev)}
          aria-label="Toggle night mode"
        >
          <span className="map-control-icon">{nightMode ? '🌙' : '☀️'}</span>
          <span>{nightMode ? 'Night' : 'Day'}</span>
          <div className={`toggle-track ${nightMode ? 'toggle-track-active' : ''}`}>
            <div className={`toggle-thumb ${nightMode ? 'toggle-thumb-active' : ''}`} />
          </div>
        </button>

        {/* Follow me toggle */}
        <button
          className={`map-control-btn ${followMe ? 'map-control-btn-active' : ''}`}
          onClick={() => setFollowMe((prev) => !prev)}
          aria-label="Toggle follow me"
        >
          <span className="map-control-icon">📍</span>
          <span>Follow Me</span>
          <div className={`toggle-track ${followMe ? 'toggle-track-active' : ''}`}>
            <div className={`toggle-thumb ${followMe ? 'toggle-thumb-active' : ''}`} />
          </div>
        </button>
      </div>

      {/* Route Finder Card */}
      <div className="route-finder-card">
        <div className="route-finder-title">
          <span className="route-finder-title-icon">🛣️</span>
          Route Safety Analysis
        </div>
        <div className="route-inputs">
          <div className="route-input-group">
            <span>A</span>
            <input 
              type="text" 
              className="route-field" 
              placeholder="Starting from..." 
              value={sourceQuery}
              onChange={(e) => {
                setSourceQuery(e.target.value);
                handleSearch(e.target.value, setSourceSuggestions);
              }}
            />
            {sourceSuggestions.length > 0 && (
              <div className="search-suggestions">
                {sourceSuggestions.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="suggestion-item"
                    onClick={() => {
                      setSourcePoint(s);
                      setSourceQuery(s.display_name);
                      setSourceSuggestions([]);
                    }}
                  >
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="route-input-group">
            <span>B</span>
            <input 
              type="text" 
              className="route-field" 
              placeholder="Destination..." 
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                handleSearch(e.target.value, setDestSuggestions);
              }}
            />
            {destSuggestions.length > 0 && (
              <div className="search-suggestions">
                {destSuggestions.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="suggestion-item"
                    onClick={() => {
                      setDestPoint(s);
                      setDestQuery(s.display_name);
                      setDestSuggestions([]);
                    }}
                  >
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="route-actions">
          <button 
            className="route-btn btn-route-check" 
            onClick={calculateRoute}
            disabled={!sourcePoint || !destPoint || isRouting}
          >
            {isRouting ? 'Analyzing...' : 'Check Safety'}
          </button>
          <button className="route-btn btn-route-clear" onClick={clearRoute}>
            Clear
          </button>
        </div>
      </div>

      {/* Route Safety Report Pill */}
      {routeReport && (
        <div className="route-report-pill">
          <span className="report-label">Overall Safety:</span>
          <div className="report-score-box">
            <span className="report-score-value">{routeReport.score}/10</span>
            <span className={`report-status status-${getScoreBadgeClass(routeReport.score)}`}>
              {routeReport.status}
            </span>
          </div>
          <div className="status-divider" style={{ background: 'rgba(212,175,55,0.3)' }} />
          <div className="report-details">
            {routeReport.cautionSegments > 0 
              ? `⚠️ ${routeReport.cautionSegments} high-risk areas detected`
              : '✅ Low-risk path detected'}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="map-legend">
        <div className="map-legend-title">Safety Legend</div>
        <div className="map-legend-items">
          <div className="map-legend-item">
            <div className="legend-dot legend-dot-safe" />
            Safer Area (7–10)
          </div>
          <div className="map-legend-item">
            <div className="legend-dot legend-dot-moderate" />
            Moderate Area (4–6)
          </div>
          <div className="map-legend-item">
            <div className="legend-dot legend-dot-caution" />
            Caution Area (0–3)
          </div>
        </div>
      </div>

      {/* Live Status Bar */}
      <div className="map-status-bar">
        {(selectedLat !== null || userLat !== null) ? (
          <>
            <div className="status-item">
              <span className="status-item-icon">📍</span>
              <span>
                {selectedLat !== null ? selectedLat.toFixed(4) : userLat?.toFixed(4)}, {selectedLng !== null ? selectedLng.toFixed(4) : userLng?.toFixed(4)}
              </span>
            </div>
            <div className="status-divider" />
            <div className="status-item">
              <span className="status-item-icon">🛡️</span>
              <span>{selectedLat !== null ? 'Point Score:' : 'Safety Score:'}</span>
              <span className="status-score">{(selectedScore !== null ? selectedScore : userScore) ?? '–'}/10</span>
            </div>
            <div className="status-divider" />
            <span
              className={`status-pill status-pill-${(selectedScore !== null ? selectedScore : userScore) !== null ? getScoreBadgeClass((selectedScore !== null ? selectedScore : userScore)!) : 'moderate'}`}
            >
              {(selectedScore !== null ? selectedScore : userScore) !== null ? getScoreLabel((selectedScore !== null ? selectedScore : userScore)!) : '…'}
            </span>
            <div className="status-divider" />
            <span className="status-time">{selectedLat !== null ? 'Selected Mode' : `Updated: ${lastUpdated}`}</span>
          </>
        ) : (
          <span className="status-no-location">
            📍 Waiting for location access…
          </span>
        )}
      </div>
    </div>
  );
}
