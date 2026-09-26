'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RouteResponse, NGOMatch } from '@/lib/api';

interface RouteMapProps {
  route: RouteResponse | null;
  ngos: NGOMatch[];
}

export default function RouteMap({ route, ngos }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // initialize map only once

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [77.5946, 12.9716], // Bengaluru
      zoom: 12,
    });

    const m = map.current;

    m.on('load', () => {
      // Kitchen marker
      const kitchenEl = document.createElement('div');
      kitchenEl.className = 'w-5 h-5 bg-navy rounded-full border-2 border-white shadow-md z-20';
      new maplibregl.Marker({ element: kitchenEl })
        .setLngLat([77.5800, 12.9600])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<h3 class="font-bold">BMTC Staff Canteen</h3><p class="text-sm">Kitchen Location</p>'))
        .addTo(m);

      // NGO Markers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ngos.forEach((ngo: any) => {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 bg-teal rounded-full border-[3px] border-white shadow-md flex items-center justify-center cursor-pointer';
        const inner = document.createElement('div');
        inner.className = 'w-1.5 h-1.5 bg-white rounded-full';
        el.appendChild(inner);

        new maplibregl.Marker({ element: el })
          .setLngLat([ngo.lng ?? ngo.distance_km, ngo.lat ?? 0])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<div class="p-1">
                 <h3 class="font-bold text-navy mb-1">${ngo.ngo_name ?? ngo.name ?? ''}</h3>
                 <p class="text-xs text-slate-600 mb-1">Score: ${ngo.match_score ?? ''}</p>
                 <span class="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded">${ngo.distance_km} km away</span>
               </div>`
            )
          )
          .addTo(m);
      });

      // Route Polyline
      if (route && route.route_geometry) {
        m.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.route_geometry,
          },
        });

        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#0d9488',
            'line-width': 4,
            'line-dasharray': [2, 2],
          },
        });
        
        const coords = route.route_geometry.coordinates;
        if (coords && coords.length > 0) {
          const bounds = new maplibregl.LngLatBounds(
            coords[0] as [number, number],
            coords[coords.length - 1] as [number, number]
          );
          for (const c of coords) {
            bounds.extend(c as [number, number]);
          }
          m.fitBounds(bounds, { padding: 50 });
        }
      } else if (route && route.route_polyline && route.route_polyline.length > 0) {
        // MapLibre uses [lng, lat] while common polylines might be [lat, lng]. Assuming [lng, lat] from backend for MapLibre or converting if needed.
        // If backend sends [lat, lng], we need to map to [lng, lat]. Let's assume the backend provides [lat, lng] as typical for routing, so we reverse it.
        const coordinates = route.route_polyline.map(coord => [coord[1], coord[0]]);

        m.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates,
            },
          },
        });

        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#16A34A',
            'line-width': 4,
            'line-dasharray': [2, 2],
          },
        });
        
        // Fit bounds to route
        const bounds = new maplibregl.LngLatBounds(
          coordinates[0] as [number, number],
          coordinates[coordinates.length - 1] as [number, number]
        );
        for (const coord of coordinates) {
          bounds.extend(coord as [number, number]);
        }
        m.fitBounds(bounds, { padding: 50 });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [route, ngos]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
