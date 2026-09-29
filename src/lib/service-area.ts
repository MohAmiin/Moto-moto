// Cities SABIQ operates in. The map is locked to the active city and riders outside it are hidden.
// To add a city (for example Mogadishu), add an entry here and the same box to
// in_service_area() in the database, then set ACTIVE_CITY or let people choose.

export type Bounds = { south: number; west: number; north: number; east: number };
export type City = { id: string; name: string; center: { lat: number; lng: number }; bounds: Bounds };

export const CITIES: City[] = [
  {
    id: 'hargeisa',
    name: 'Hargeisa',
    center: { lat: 9.5624, lng: 44.077 },
    // Covers the city with a margin for the outer neighbourhoods.
    bounds: { south: 9.47, west: 43.95, north: 9.64, east: 44.17 },
  },
];

export const ACTIVE_CITY = CITIES[0];

export function inCity(point: { lat: number; lng: number } | null | undefined, city: City = ACTIVE_CITY) {
  if (!point) return false;
  const b = city.bounds;
  return point.lat >= b.south && point.lat <= b.north && point.lng >= b.west && point.lng <= b.east;
}
