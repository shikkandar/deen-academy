import type { Coords } from './prayer';

const KAABA = { latitude: 21.422487, longitude: 39.826206 };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Degrees clockwise from true north to the Kaaba (great-circle initial bearing). */
export function qiblaBearing(from: Coords) {
  const φ1 = rad(from.latitude);
  const φ2 = rad(KAABA.latitude);
  const Δλ = rad(KAABA.longitude - from.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Kilometres to the Kaaba. */
export function distanceToKaaba(from: Coords) {
  const φ1 = rad(from.latitude);
  const φ2 = rad(KAABA.latitude);
  const a =
    Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(rad(KAABA.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Signed difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number) {
  return ((a - b + 540) % 360) - 180;
}

/** Eight-point compass name, e.g. 292° -> "W·NW". */
export function compassPoint(bearing: number) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(bearing / 45) % 8];
}
