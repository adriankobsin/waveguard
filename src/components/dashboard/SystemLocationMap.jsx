import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function MapViewUpdater({ latitude, longitude, zoom = 11, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    map.invalidateSize();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.setView([latitude, longitude], zoom, { animate: false });
  }, [map, latitude, longitude, zoom, active]);
  return null;
}

/**
 * Leaflet map for system geolocation. Supports compact (widget) and full-page layouts.
 */
export default function SystemLocationMap({
  latitude,
  longitude,
  hasCoords,
  center,
  zoom = 11,
  active = true,
  compact = false,
  className = "",
}) {
  const mapCenter = hasCoords ? [latitude, longitude] : center || [51.505, -0.09];
  const mapZoom = hasCoords ? zoom : 3;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      scrollWheelZoom={!compact}
      dragging={!compact}
      zoomControl={!compact}
      className={`h-full w-full z-0 ${className}`}
      style={{ minHeight: compact ? "140px" : "360px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasCoords && (
        <>
          <Marker position={[latitude, longitude]} />
          <MapViewUpdater
            latitude={latitude}
            longitude={longitude}
            zoom={mapZoom}
            active={active}
          />
        </>
      )}
    </MapContainer>
  );
}
