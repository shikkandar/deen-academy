import * as Location from 'expo-location';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Vec = [number, number, number];

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export type Heading = {
  /** Degrees from true north the phone is looking at: through the back camera when held upright, else its top edge. */
  degrees: number;
  /** Held upright (camera looking ahead) rather than lying flat. */
  upright: boolean;
  /** Magnetometer needs a figure-8 calibration. */
  needsCalibration: boolean;
};

/**
 * The direction the phone is looking, from the accelerometer and magnetometer. Unlike the plain compass
 * heading (which only works lying flat), this follows the back camera when the phone is held up, for the
 * camera view of the Qibla. Corrected from magnetic to true north with the local declination.
 */
export function useLookHeading(active: boolean): Heading | null {
  const [heading, setHeading] = useState<Heading | null>(null);
  const acc = useRef<Vec | null>(null);
  const mag = useRef<Vec | null>(null);
  const declination = useRef(0);
  const calibration = useRef(3);

  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    const sign = Platform.OS === 'ios' ? -1 : 1; // iOS reports gravity the other way round
    const smooth = (prev: Vec | null, next: Vec, k = 0.15): Vec =>
      prev ? [prev[0] + k * (next[0] - prev[0]), prev[1] + k * (next[1] - prev[1]), prev[2] + k * (next[2] - prev[2])] : next;

    const update = () => {
      if (!acc.current || !mag.current) return;
      const up = norm(acc.current);
      const east = norm(cross(mag.current, up));
      const north = cross(up, east);
      const camera: Vec = [0, 0, -1];
      const top: Vec = [0, 1, 0];
      const upright = Math.abs(dot(camera, up)) < 0.7; // the camera looks more ahead than down
      const look = upright ? camera : top;
      const magnetic = (Math.atan2(dot(look, east), dot(look, north)) * 180) / Math.PI;
      setHeading({
        degrees: (magnetic + declination.current + 720) % 360,
        upright,
        needsCalibration: calibration.current < 2,
      });
    };

    Accelerometer.setUpdateInterval(60);
    Magnetometer.setUpdateInterval(60);
    const a = Accelerometer.addListener(({ x, y, z }) => {
      acc.current = smooth(acc.current, [sign * x, sign * y, sign * z]);
    });
    const m = Magnetometer.addListener(({ x, y, z }) => {
      mag.current = smooth(mag.current, [x, y, z]);
      update();
    });
    // The OS compass knows the local declination (true - magnetic north) and the calibration state.
    let loc: Location.LocationSubscription | null = null;
    Location.watchHeadingAsync((h) => {
      if (h.trueHeading >= 0) declination.current = ((h.trueHeading - h.magHeading + 540) % 360) - 180;
      calibration.current = h.accuracy;
    })
      .then((s) => (loc = s))
      .catch(() => {});

    return () => {
      a.remove();
      m.remove();
      loc?.remove();
    };
  }, [active]);

  return heading;
}
