import type { WorkUnit } from '../api/user';

/**
 * Distância em metros entre duas coordenadas (fórmula de Haversine) — espelha
 * o cálculo feito no backend (TimeRecordController::calculateDistance).
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const latDelta = deg2rad(lat2 - lat1);
  const lonDelta = deg2rad(lon2 - lon1);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(lonDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadius * c);
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export type GeofenceCheck = { withinRadius: boolean; distanceMeters: number };

/**
 * Checagem prévia no cliente — feedback imediato ao funcionário. O servidor
 * continua sendo a autoridade final: isto não impede o envio, só avisa.
 */
export function checkGeofence(coords: { latitude: number; longitude: number }, workUnit: WorkUnit): GeofenceCheck {
  const distanceMeters = calculateDistanceMeters(workUnit.latitude, workUnit.longitude, coords.latitude, coords.longitude);
  return { withinRadius: distanceMeters <= workUnit.radius_meters, distanceMeters };
}
