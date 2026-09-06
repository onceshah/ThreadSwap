import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapProduct {
  id: number;
  name: string;
  seller: string;
  price: number;
  lat: number;
  lng: number;
  image: string;
  condition: string;
  type: string;
  distance: string;
  location?: string;
}

export const defaultMapProducts: MapProduct[] = [
  { id: 1, name: "Levi's 501 Jeans", seller: "Meera K.", price: 899, lat: 19.1363, lng: 72.8277, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&h=200&fit=crop&auto=format", condition: "Gently Used", type: "Sell", distance: "1.2 km", location: "Andheri West, Mumbai" },
  { id: 2, name: "Vintage Floral Kurta", seller: "Aarti S.", price: 450, lat: 19.0596, lng: 72.8295, image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=200&h=200&fit=crop&auto=format", condition: "Well Worn", type: "Exchange", distance: "0.8 km", location: "Bandra West, Mumbai" },
  { id: 3, name: "Nike Air Max 90", seller: "Rohan D.", price: 1800, lat: 19.1075, lng: 72.8263, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&auto=format", condition: "Gently Used", type: "Sell", distance: "2.4 km", location: "Juhu, Mumbai" },
  { id: 4, name: "Handwoven Tote Bag", seller: "Priti V.", price: 0, lat: 19.1176, lng: 72.9060, image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop&auto=format", condition: "Gently Used", type: "Free/Donate", distance: "3.1 km", location: "Powai, Mumbai" },
  { id: 5, name: "Oversized Linen Blazer", seller: "Kavita R.", price: 1200, lat: 19.0700, lng: 72.8338, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop&auto=format", condition: "Brand New", type: "Sell", distance: "1.8 km", location: "Khar West, Mumbai" },
  { id: 6, name: "Wool Blend Overcoat", seller: "Ananya R.", price: 2200, lat: 19.0176, lng: 72.8170, image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=200&h=200&fit=crop&auto=format", condition: "Brand New", type: "Sell", distance: "3.5 km", location: "Worli, Mumbai" },
];

const knownMumbaiLocations: Record<string, [number, number]> = {
  "Andheri West, Mumbai": [19.1363, 72.8277],
  "Andheri, Mumbai": [19.1363, 72.8277],
  "Bandra West, Mumbai": [19.0596, 72.8295],
  "Bandra, Mumbai": [19.0596, 72.8295],
  "Juhu, Mumbai": [19.1075, 72.8263],
  "Powai, Mumbai": [19.1176, 72.9060],
  "Khar West, Mumbai": [19.0700, 72.8338],
  "Khar, Mumbai": [19.0700, 72.8338],
  "Worli, Mumbai": [19.0176, 72.8170]
};

function getSanitizedCoords(prod: MapProduct): [number, number] {
  let lat = 19.1363, lng = 72.8277;
  if (typeof prod.lat === 'number' && !isNaN(prod.lat) && typeof prod.lng === 'number' && !isNaN(prod.lng) && (prod.lat !== 0 || prod.lng !== 0)) {
    lat = prod.lat;
    lng = prod.lng;
  } else if (prod.location && knownMumbaiLocations[prod.location]) {
    [lat, lng] = knownMumbaiLocations[prod.location];
  }
  
  // Add a tiny pseudo-random offset based on ID to prevent exact overlapping of markers
  const offset = (Number(String(prod.id).replace(/\D/g, '')) % 100) * 0.0001;
  return [lat + offset, lng + offset];
}

export default function OpenStreetMapContainer({ 
  productsList = defaultMapProducts, 
  onSelectProduct 
}: { 
  productsList?: MapProduct[]; 
  onSelectProduct: (product: any) => void; 
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const firstCoord = productsList.length > 0 ? getSanitizedCoords(productsList[0]) : [19.1363, 72.8277];
    const map = L.map(mapContainerRef.current, {
      center: firstCoord,
      zoom: 13,
      scrollWheelZoom: true
    });

    // OsmDroid OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (OsmDroid API) · Mumbai, India'
    }).addTo(map);

    // Add Item Marker Pins to Map
    productsList.forEach(prod => {
      const [lat, lng] = getSanitizedCoords(prod);
      const priceText = prod.price === 0 ? 'FREE' : `₹${prod.price}`;

      const markerIcon = L.divIcon({
        className: 'custom-osm-pin',
        html: `
          <div style="background-color: #c46212; color: white; border: 2px solid white; border-radius: 12px; padding: 4px 8px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <span>📍</span>
            <span>${priceText}</span>
          </div>
        `,
        iconSize: [75, 30],
        iconAnchor: [37, 15]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);

      const popupContent = `
        <div style="font-family: sans-serif; width: 190px; padding: 2px;">
          <img src="${prod.image}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 10px; margin-bottom: 6px;" />
          <strong style="display: block; font-size: 13px; color: #1c1917; margin-bottom: 2px;">${prod.name}</strong>
          <span style="font-size: 11px; color: #78716c; display: block; margin-bottom: 4px;">📍 ${prod.location || 'Andheri West, Mumbai'}</span>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span style="font-weight: 800; font-size: 13px; color: #c46212;">${priceText}</span>
            <button id="osm-btn-${prod.id}" style="background-color: #c46212; color: white; border: none; border-radius: 8px; padding: 5px 10px; font-size: 10px; font-weight: 700; cursor: pointer;">
              Chat & Buy
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`osm-btn-${prod.id}`);
        if (btn) {
          btn.onclick = () => onSelectProduct(prod);
        }
      });
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [productsList]);

  return (
    <div className="relative w-full h-[580px] rounded-3xl overflow-hidden border border-border shadow-lg">
      <div ref={mapContainerRef} className="w-full h-full z-10" />
      
      {/* OsmDroid Map API Header Overlay */}
      <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-border shadow-sm flex items-center gap-2 text-xs font-bold text-foreground">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>📍 OsmDroid OpenStreetMap — Andheri West, Mumbai Center</span>
      </div>
    </div>
  );
}
