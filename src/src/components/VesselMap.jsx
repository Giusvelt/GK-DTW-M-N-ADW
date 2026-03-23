import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useVesselStore } from '../store/useVesselStore';
import { useGeofenceStore } from '../store/useGeofenceStore';

// Custom vessel icon builder
const createVesselIcon = (heading = 0, isMoving = false) => {
    const color = isMoving ? '#3b82f6' : '#64748b';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" transform="rotate(${heading})">
        <path d="M12 2 L8 20 L12 17 L16 20 Z"/>
    </svg>`;
    return L.divIcon({
        html: svg,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
};

// Geofence nature → color
const geoColor = (nature) => {
    const map = {
        'loading_site': '#10b981',
        'unloading_site': '#f59e0b',
        'anchorage': '#8b5cf6',
        'port': '#3b82f6',
        'rada': '#6366f1',
        'mooring': '#06b6d4'
    };
    return map[nature?.toLowerCase()] || '#64748b';
};

export default function VesselMap({ height = '100%' }) {
    const vesselPositions = useVesselStore(s => s.vesselPositions);
    const geofences = useGeofenceStore(s => s.geofences);
    // Parse polygon coords safely
    const parsedGeofences = useMemo(() => {
        return geofences.map(g => {
            try {
                const coords = typeof g.polygon_coords === 'string'
                    ? JSON.parse(g.polygon_coords)
                    : g.polygon_coords;
                if (Array.isArray(coords) && coords.length >= 3) {
                    return { ...g, parsedCoords: coords };
                }
            } catch { /* skip malformed */ }
            return null;
        }).filter(Boolean);
    }, [geofences]);

    // Valid vessel positions only
    const validPositions = useMemo(() =>
        (vesselPositions || []).filter(p => p.lat && p.lon && p.lat !== 0),
        [vesselPositions]);

    // Set center fixed to Genova/Ligurian sea area as requested
    const center = [43.8, 9.0];

    return (
        <MapContainer
            center={center}
            zoom={7}
            style={{ height, width: '100%', borderRadius: '16px' }}
            zoomControl={false}
            className="map-tiles-contrast"
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CartoDB'
            />

            {/* Geofence polygons */}
            {parsedGeofences.map(g => (
                <Polygon
                    key={g.id}
                    positions={g.parsedCoords}
                    pathOptions={{
                        color: geoColor(g.nature),
                        fillColor: geoColor(g.nature),
                        fillOpacity: 0.15,
                        weight: 2
                    }}
                >
                    <Popup>
                        <strong>{g.name}</strong><br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {g.nature || 'General'}
                        </span>
                    </Popup>
                </Polygon>
            ))}

            {/* Vessel markers */}
            {validPositions.map(pos => (
                <Marker
                    key={pos.vessel}
                    position={[pos.lat, pos.lon]}
                    icon={createVesselIcon(pos.heading, pos.speed > 0.8)}
                >
                    <Popup>
                        <strong>{pos.vessel}</strong><br />
                        <span style={{ fontSize: '11px' }}>
                            Speed: {pos.speed?.toFixed(1)} kn<br />
                            Status: {pos.status}
                        </span>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
