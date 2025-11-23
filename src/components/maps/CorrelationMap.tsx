import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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

const CorrelationMap = () => {
  const { position: userLocation, error: locationError, loading: locationLoading } = useUserLocation();

  const { data: correlations = [], isLoading: correlationsLoading } = useQuery({
    queryKey: ['nearbyCorrelations', userLocation?.latitude, userLocation?.longitude],
    queryFn: () => fetchNearbyCorrelations(userLocation!.latitude, userLocation!.longitude, 10000), // 10km radius
    enabled: !!userLocation,
  });

  const mapCenter: [number, number] = userLocation ? [userLocation.latitude, userLocation.longitude] : defaultCenter;

  if (locationLoading) {
    return <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>;
  }

  if (locationError) {
    return <div className="flex items-center justify-center h-full"><p className="text-red-500">Error: {locationError}</p></div>;
  }

  return (
    <MapContainer center={mapCenter} zoom={12} style={containerStyle}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

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
    </MapContainer>
  );
};

export default CorrelationMap;
