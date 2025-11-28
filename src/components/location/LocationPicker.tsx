import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Fix for default marker icon with Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

type Suggestion = {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
  class?: string;
  type?: string;
};

type Props = {
  initial?: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
};

const defaultCenter = { lat: 20.5937, lng: 78.9629 };
const containerStyle = { width: '100%', height: '320px' } as const;

const ClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
};

const MapController: React.FC<{ setMap: (m: L.Map) => void }> = ({ setMap }) => {
  const map = useMapEvents({});
  useEffect(() => { setMap(map); }, [map, setMap]);
  return null;
};

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
];

export default function LocationPicker({ initial = null, onConfirm }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(initial);
  const [map, setMap] = useState<L.Map | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const country = 'India';
  const [stateName, setStateName] = useState('');
  const [districtSuggestions, setDistrictSuggestions] = useState<Suggestion[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [pincode, setPincode] = useState('');
  const [landmarkRef, setLandmarkRef] = useState('');

  useEffect(() => { if (initial) setSelected(initial); }, [initial]);

  // Nominatim search for free-text query
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) { setSuggestions([]); return; }
    setLoading(true); setSearchError(null);
    abortRef.current?.abort();
    const ac = new AbortController(); abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const email = import.meta.env.VITE_NOMINATIM_EMAIL;
        const base = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=8`;
        const url = email ? `${base}&email=${encodeURIComponent(email)}` : base;
        const res = await fetch(url, { signal: ac.signal, headers: { 'Accept-Language': 'en' } });
        if (!res.ok) { setSearchError(`Search failed (${res.status})`); setSuggestions([]); return; }
        const json = await res.json();
        const mapped = (json || []).map((it: any) => ({
          place_id: it.place_id ?? it.osm_id,
          display_name: it.display_name,
          lat: it.lat,
          lon: it.lon,
          boundingbox: it.boundingbox,
          class: it.class,
          type: it.type,
        } as Suggestion));
        setSuggestions(mapped);
      } catch (err) {
        if ((err as any).name !== 'AbortError') setSearchError('Search failed');
      } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query]);

  // Fetch districts for selected state using Overpass
  useEffect(() => {
    if (!stateName) { setDistrictSuggestions([]); setSelectedDistrictId(null); return; }
    let cancelled = false; setDistrictLoading(true);
    (async () => {
      try {
        const qq = `[out:json][timeout:25];area["name"="${stateName}"]["boundary"="administrative"]["admin_level"="4"]->.a;relation(area.a)["admin_level"="6"]["boundary"="administrative"];out center tags;`;
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: qq, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
        if (!res.ok) { setDistrictSuggestions([]); return; }
        const json = await res.json();
        const elems = json.elements || [];
        const mapped = elems.map((el: any) => ({ place_id: el.id, display_name: el.tags?.name || String(el.id), lat: el.center?.lat ? String(el.center.lat) : '0', lon: el.center?.lon ? String(el.center.lon) : '0', type: 'district' } as Suggestion));
        if (!cancelled) { setDistrictSuggestions(mapped); setSelectedDistrictId(null); }
      } catch (err) {
        console.error('Overpass error', err);
      } finally { setDistrictLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [stateName]);

  const onSelectSuggestion = (s: Suggestion) => {
    const lat = Number(s.lat), lon = Number(s.lon);
    setSelected({ lat, lng: lon } as any);
    setSuggestions([]);
    setQuery(s.display_name);
    if (!map) return;
    try { map.invalidateSize(); } catch {}
    if (s.boundingbox && s.boundingbox.length === 4) {
      const south = Number(s.boundingbox[0]), north = Number(s.boundingbox[1]), west = Number(s.boundingbox[2]), east = Number(s.boundingbox[3]);
      try { map.fitBounds([[south, west], [north, east]], { padding: [40, 40] }); } catch { map.setView([lat, lon], 14); }
    } else {
      map.flyTo([lat, lon], 14, { duration: 0.6 });
    }
  };

  const handleDistrictPick = (id: string) => {
    setSelectedDistrictId(id || null);
    const found = districtSuggestions.find(d => String(d.place_id) === id);
    if (!found) return;
    const lat = Number(found.lat), lon = Number(found.lon);
    setSelected({ lat, lng: lon } as any);
    if (!map) return;
    try { map.invalidateSize(); } catch {}
    try { map.setView([lat, lon], 10); } catch {}
  };

  const locateByPincode = async () => {
    const code = pincode.trim(); if (!code) return;
    const parts: string[] = [code];
    const districtName = selectedDistrictId ? districtSuggestions.find(d => String(d.place_id) === selectedDistrictId)?.display_name : undefined;
    if (districtName) parts.push(districtName);
    if (stateName) parts.push(stateName); if (country) parts.push(country);
    const q = parts.join(' ');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } }); if (!res.ok) return;
      const json = await res.json(); if (!json || json.length === 0) return;
      const first = json[0]; const lat = Number(first.lat), lon = Number(first.lon);
      setSelected({ lat, lng: lon } as any); setQuery(first.display_name || q);
      if (map) { try { map.invalidateSize(); } catch {} try { map.flyTo([lat, lon], 14, { duration: 0.6 }); } catch {} }
    } catch (err) { console.error('Pincode locate error', err); }
  };

  const locateByLandmark = async () => {
    const lm = landmarkRef.trim(); if (!lm) return;
    const parts: string[] = [lm];
    const districtName = selectedDistrictId ? districtSuggestions.find(d => String(d.place_id) === selectedDistrictId)?.display_name : undefined;
    if (districtName) parts.push(districtName);
    if (stateName) parts.push(stateName); if (country) parts.push(country);
    const q = parts.join(' ');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } }); if (!res.ok) return;
      const json = await res.json(); if (!json || json.length === 0) return;
      const first = json[0]; const lat = Number(first.lat), lon = Number(first.lon);
      setSelected({ lat, lng: lon } as any); setQuery(first.display_name || q);
      if (map) { try { map.invalidateSize(); } catch {} try { map.flyTo([lat, lon], 14, { duration: 0.6 }); } catch {} }
    } catch (err) { console.error('Landmark locate error', err); }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Country</label>
          <Input value={country} readOnly />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">State / UT</label>
          <select value={stateName} onChange={e => setStateName(e.target.value)} className="w-full rounded-md border px-2 py-2 bg-transparent text-sm">
            <option value="">Select state</option>
            {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Select District</label>
          <select value={selectedDistrictId ?? ''} onChange={e => handleDistrictPick(e.target.value)} className="w-full rounded-md border px-2 py-2 bg-transparent text-sm">
            <option value="">Choose district</option>
            {districtSuggestions.map(d => <option key={String(d.place_id)} value={String(d.place_id)}>{d.display_name}</option>)}
          </select>
          {stateName && districtLoading && <div className="text-xs text-muted-foreground mt-1">Loading districts...</div>}
          {stateName && !districtLoading && districtSuggestions.length === 0 && <div className="text-xs text-muted-foreground mt-1">No districts found for this state.</div>}
        </div>
      </div>

      <div className="relative">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a place or address" />
        {loading && <div className="absolute z-30 mt-1 w-full rounded-md border border-white/10 bg-card shadow-lg px-3 py-2 text-sm">Searching...</div>}
        {searchError && <div className="absolute z-30 mt-1 w-full rounded-md border border-red-400 bg-red-50 text-red-700 shadow-sm px-3 py-2 text-sm">{searchError}</div>}
        {suggestions.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-white/10 bg-card shadow-lg max-h-60 overflow-auto">
            {suggestions.map(s => (
              <button key={String(s.place_id)} type="button" onClick={() => onSelectSuggestion(s)} className="w-full text-left px-3 py-2 hover:bg-white/5">
                <div className="flex items-center justify-between"><div className="text-sm">{s.display_name}</div><div className="ml-2 text-xs text-muted-foreground">{s.type ?? s.class}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Pincode</label>
          <div className="flex">
            <Input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="e.g. 110001" />
            <Button onClick={locateByPincode} className="ml-2" type="button">Locate</Button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Reference Landmark</label>
          <div className="flex">
            <Input value={landmarkRef} onChange={e => setLandmarkRef(e.target.value)} placeholder="e.g. Near City Mall" />
            <Button onClick={locateByLandmark} className="ml-2" type="button">Locate Landmark</Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-white/10 bg-white/2">
        <MapContainer center={initial ? [initial.lat, initial.lng] : [defaultCenter.lat, defaultCenter.lng]} zoom={initial ? 13 : 5} style={containerStyle}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          <ClickHandler onClick={(lat, lng) => setSelected({ lat, lng })} />
          <MapController setMap={setMap} />
          {selected && (
            <Marker position={[selected.lat, selected.lng]} draggable eventHandlers={{ dragend: (e: any) => { const latlng = e.target.getLatLng(); setSelected({ lat: latlng.lat, lng: latlng.lng }); } }} />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selected ? (<><div className="font-mono">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</div><div className="text-xs text-muted-foreground">Click on map or drag marker to fine-tune location</div></>) : (<div className="text-sm">No location selected yet.</div>)}
        </div>
        <div>
          <Button type="button" onClick={() => selected && onConfirm(selected.lat, selected.lng)} disabled={!selected} className="rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">Use This Location</Button>
        </div>
      </div>
    </div>
  );
}
