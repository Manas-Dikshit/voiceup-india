import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, { useEffect } from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useVote } from '@/hooks/useVote';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// Fix for default marker icon issue with bundlers like Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter: [number, number] = [20.5937, 78.9629];

interface Correlation {
  region_id: string;
  category_a: string;
  category_b: string;
  correlation_score: number;
  co_occurrence: number;
  center_point_wkt: string;
}

const fetchNearbyCorrelations = async (latitude: number, longitude: number, radius: number) => {
  const { data, error } = await supabase.rpc('get_nearby_correlations', {
    lat: latitude,
    lng: longitude,
    radius: radius,
  });
  if (error) throw new Error(error.message);
  return data as Correlation[] || [];
};

const parseWktPoint = (wkt: string): [number, number] | null => {
    if (!wkt || !wkt.includes('POINT')) return null;
    const coords = wkt.replace(/POINT\(|\)/g, '').trim().split(' ');
    const lat = parseFloat(coords[1]);
    const lng = parseFloat(coords[0]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
}

const categoryColors: { [key: string]: string } = {
    roads: '#6b7280', // gray
    water: '#3b82f6', // blue
    electricity: '#f59e0b', // amber
    sanitation: '#10b981', // emerald
    education: '#8b5cf6', // violet
    healthcare: '#ef4444', // red
    pollution: '#d97706', // yellow-orange
    safety: '#ec4899', // pink
    other: '#a1a1aa', // neutral
};

const getBlendedColor = (catA: string, catB: string) => {
    const colorA = categoryColors[catA] || categoryColors['other'];
    const colorB = categoryColors[catB] || categoryColors['other'];
    // This is a simple visual blend, not a true color mix.
    // It creates a gradient from one color to the other.
    return `linear-gradient(45deg, ${colorA}, ${colorB})`;
};

type Focus = { lat?: number | null; lng?: number | null; zoom?: number; id?: string | number; pincode?: string } | null;

const _RecenterMap = ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (map && lat != null && lng != null) {
      try {
        map.flyTo([lat, lng], zoom || 14, { duration: 0.8 });
      } catch (e) {
        map.setView([lat, lng], zoom || 14);
      }
    }
  }, [map, lat, lng, zoom]);
  return null;
};

const CorrelationMap = ({ focus }: { focus?: Focus }) => {
  const { position: userLocation, error: locationError, loading: locationLoading } = useUserLocation();

  const { data: correlations = [], isLoading: correlationsLoading } = useQuery({
    queryKey: ['nearbyCorrelations', userLocation?.latitude, userLocation?.longitude],
    queryFn: () => fetchNearbyCorrelations(userLocation!.latitude, userLocation!.longitude, 10000), // 10km radius
    enabled: !!userLocation,
  });

  // Fetch nearby problems to show as markers
  const fetchNearbyProblemsForMap = async (latitude: number, longitude: number, radiusMeters: number) => {
    // approximate degree delta
    const radiusKm = radiusMeters / 1000;
    const latDelta = radiusKm / 110.574; // degrees per km
    const lngDelta = radiusKm / (111.320 * Math.cos((latitude * Math.PI) / 180));

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    const { data, error } = await supabase
      .from('problems')
      .select('*')
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return (data || []) as any[];
  };

  const { data: problemMarkers = [], isLoading: problemsLoading } = useQuery({
    queryKey: ['nearbyProblemsMap', userLocation?.latitude, userLocation?.longitude],
    queryFn: () => fetchNearbyProblemsForMap(userLocation!.latitude, userLocation!.longitude, 20000), // 20km
    enabled: !!userLocation,
  });

  const voteMutation = useVote();
  const navigate = useNavigate();

  // Fetch votes for the problems rendered on the map
  const problemIds = (problemMarkers || []).map((p) => p.id).filter(Boolean);
  const { data: votesForMap = [] } = useQuery({
    queryKey: ['votesForMap', ...problemIds],
    queryFn: async () => {
      if (!problemIds.length) return [];
      const { data, error } = await supabase
        .from('votes')
        .select('votable_id, vote_type')
        .eq('votable_type', 'problem')
        .in('votable_id', problemIds as any[]);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: problemIds.length > 0,
  });

  // build a map of counts by problem id
  const voteCountsByProblem: Record<string, { up: number; down: number }> = {};
  (votesForMap || []).forEach((v: any) => {
    const id = v.votable_id;
    if (!voteCountsByProblem[id]) voteCountsByProblem[id] = { up: 0, down: 0 };
    if (v.vote_type === 'upvote') voteCountsByProblem[id].up += 1;
    if (v.vote_type === 'downvote') voteCountsByProblem[id].down += 1;
  });

  const mapCenter: [number, number] = userLocation ? [userLocation.latitude, userLocation.longitude] : defaultCenter;

  // marker refs map (must be a hook and called unconditionally to keep hook order stable)
  const markerRefs = React.useRef<Record<string, any> | null>({});

  if (locationLoading) {
    return <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>;
  }

  if (locationError) {
    return <div className="flex items-center justify-center h-full"><p className="text-red-500">Error: {locationError}</p></div>;
  }

  // handle focus: recenter and open popup when focus prop changes
  const map = (null as any);
  // We'll use a useEffect below with useMap inside a small component if needed. Simpler: use a ref to capture the map via react-leaflet's context by rendering a helper component.

  const FocusHandler = ({ focus }: { focus?: Focus }) => {
    const mapInstance = (useMap as any)();
    React.useEffect(() => {
      if (!focus || !mapInstance) return;
      const { lat, lng, zoom, id, pincode } = focus;

      const openPopupForId = (problemId?: string | number) => {
        if (!problemId) return;
        const ref = markerRefs.current && markerRefs.current[problemId];
        if (ref) {
          try {
            if (typeof ref.openPopup === 'function') ref.openPopup();
            else if (ref.leafletElement && typeof ref.leafletElement.openPopup === 'function') ref.leafletElement.openPopup();
          } catch (err) {
            // ignore
          }
          return true;
        }
        return false;
      };

      const tryFly = (targetLat?: number | null, targetLng?: number | null) => {
        if (targetLat == null || targetLng == null) return;
        try {
          mapInstance.flyTo([targetLat, targetLng], zoom || 14, { duration: 0.6 });
        } catch (e) {
          mapInstance.setView([targetLat, targetLng], zoom || 14);
        }
      };

      // If coordinates available, fly and open popup
      if (lat != null && lng != null) {
        tryFly(lat, lng);
        // Try to open the popup immediately, otherwise retry a few times in case markers are still rendering
        if (!openPopupForId(id)) {
          let attempts = 0;
          const iv = setInterval(() => {
            attempts += 1;
            if (openPopupForId(id) || attempts >= 6) clearInterval(iv);
          }, 500);
        }
        return;
      }

      // If no coords but pincode provided, try to geocode via Nominatim
      if (pincode) {
        (async () => {
          try {
            const query = encodeURIComponent(`${pincode}, India`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&postalcode=${encodeURIComponent(pincode)}&limit=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              const entry = json[0];
              const gLat = Number(entry.lat);
              const gLng = Number(entry.lon);
              if (!isNaN(gLat) && !isNaN(gLng)) {
                tryFly(gLat, gLng);
                // try open popup (marker might be present if problems were loaded)
                if (!openPopupForId(id)) {
                  let attempts = 0;
                  const iv = setInterval(() => {
                    attempts += 1;
                    if (openPopupForId(id) || attempts >= 6) clearInterval(iv);
                  }, 500);
                }
                return;
              }
            }
          } catch (err) {
            // ignore geocode errors
            console.error('Pincode geocode failed', err);
          }
        })();
      }

      // Fallback: try opening popup if already available
      openPopupForId(id);
    }, [focus, mapInstance]);
    return null;
  };

  return (
    <MapContainer center={mapCenter} zoom={12} style={containerStyle}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Recenter component to change view when focus prop provided */}
      {focus && (
        <FocusHandler focus={focus} />
      )}

      {correlationsLoading ? (
        <div className="flex items-center justify-center h-full"><p>Loading correlation data...</p></div>
      ) : (
        correlations.map((c) => {
          const position = parseWktPoint(c.center_point_wkt);
          if (!position) return null;

          const iconSize = 20 + (c.correlation_score * 30); // Size based on score
          const iconColor = getBlendedColor(c.category_a, c.category_b);

          const customIcon = new L.DivIcon({
            className: 'custom-div-icon',
            html: `<div style='background: ${iconColor}; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; opacity: 0.7;'></div>`,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2]
          });

          return (
            <Marker
              key={c.region_id + c.category_a + c.category_b}
              position={position}
              icon={customIcon}
            >
              <Popup>
                <Card className="border-none shadow-none">
                  <CardHeader className="p-2">
                    <CardTitle className="text-base">Correlation Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 text-sm">
                    <p><strong>Categories:</strong> {c.category_a} &harr; {c.category_b}</p>
                    <p><strong>Score:</strong> {c.correlation_score.toFixed(2)}</p>
                    <p><strong>Co-occurrences:</strong> {c.co_occurrence}</p>
                  </CardContent>
                </Card>
              </Popup>
            </Marker>
          );
        })
      )}

      {/* Problem markers */}
      {problemsLoading ? null : (
        problemMarkers.map((p) => {
          if (p.latitude == null || p.longitude == null) return null;
          const position: [number, number] = [Number(p.latitude), Number(p.longitude)];

          const counts = voteCountsByProblem[p.id] || { up: 0, down: 0 };
          // create a small label icon that shows the title and net votes directly on the map
          const titleRaw = (p.title || '').toString();
          const titleTrunc = titleRaw.length > 30 ? titleRaw.slice(0, 27) + '...' : titleRaw;
          const net = (counts.up || 0) - (counts.down || 0);
          const netLabel = net >= 0 ? `+${net}` : `${net}`;

          const problemIcon = new L.DivIcon({
            className: 'problem-label-icon',
            html: `<div style="background: rgba(255,255,255,0.95); padding:4px 8px; border-radius:12px; border:1px solid #e5e7eb; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.06); display:flex; gap:8px; align-items:center;">
                      <span style=\"font-weight:600; color:#111827; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\">${titleTrunc}</span>
                      <span style=\"background:${net>=0? '#ecfdf5' : '#fff1f2'}; color:${net>=0? '#065f46' : '#b91c1c'}; padding:2px 6px; border-radius:999px; font-weight:700; font-size:11px;\">${netLabel}</span>
                    </div>`,
            iconSize: [Math.min(220, 12 * titleTrunc.length + 60), 32],
            iconAnchor: [10, 32],
          });

          return (
            <Marker
              key={`problem-${p.id}`}
              position={position}
              icon={problemIcon}
              ref={(m) => {
                // store ref in the markerRefs map for later popup opening
                try {
                  if (m) {
                    // react-leaflet v4 provides the underlying Leaflet element via m as any
                    markerRefs.current = markerRefs.current || {};
                    markerRefs.current[p.id] = (m as any)?.leafletElement ?? (m as any);
                  } else if (markerRefs.current) {
                    delete markerRefs.current[p.id];
                  }
                } catch (e) {
                  // ignore
                }
              }}
            >
              <Popup>
                <Card className="border-none shadow-none max-w-xs">
                  <CardHeader className="p-2">
                    <CardTitle className="text-base">
                      <button
                        className="text-left text-primary hover:underline"
                        onClick={() => navigate(`/problems/${p.id}`)}
                      >
                        {p.title}
                      </button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 text-sm">
                    <p className="mb-2">{p.description?.slice(0, 200)}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => voteMutation.mutate({ problemId: p.id, voteType: 'upvote' })}>
                        👍 Upvote
                      </Button>
                      <div className="text-sm">{counts.up}</div>
                      <Button size="sm" variant="destructive" onClick={() => voteMutation.mutate({ problemId: p.id, voteType: 'downvote' })}>
                        👎 Downvote
                      </Button>
                      <div className="text-sm">{counts.down}</div>
                      <div className="ml-auto text-xs text-muted-foreground">Net: {p.votes_count ?? 0}</div>
                    </div>
                  </CardContent>
                </Card>
              </Popup>
            </Marker>
          );
        })
      )}
    </MapContainer>
  );
};

export default CorrelationMap;
