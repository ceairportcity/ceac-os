export function getPositionOnce(geo = globalThis.navigator?.geolocation) {
  return new Promise((resolve) => {
    if (!geo) return resolve({ failure: "Location is unavailable on this device" });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    // Desktop browsers may fail high-accuracy positioning even when an ordinary
    // browser position is available. Fall back only after an acquisition failure;
    // never retry a permission denial or invent coordinates.
    const timer = setTimeout(() => finish({ failure: "Location request timed out" }), 15000);
    const request = (enableHighAccuracy) => {
      try {
        geo.getCurrentPosition((position) => {
          if (settled) return;
          const { latitude: lat, longitude: lng, accuracy } = position.coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
              || !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 120000) {
            return finish({ failure: "A fresh valid location could not be obtained" });
          }
          finish({ lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
            capturedAt: new Date(position.timestamp).toISOString() });
        }, (error) => {
          if (settled) return;
          if (error?.code === 1) return finish({ failure: "Location permission was denied" });
          if (enableHighAccuracy) return request(false);
          finish({ failure: error?.code === 3 ? "Location request timed out" : "Location could not be obtained" });
        }, { timeout: 6500, maximumAge: 0, enableHighAccuracy });
      } catch {
        if (enableHighAccuracy) request(false);
        else finish({ failure: "Location could not be obtained" });
      }
    };
    request(true);
  });
}

export async function getForegroundPosition(nav = globalThis.navigator, read = getPositionOnce) {
  try {
    const permission = await nav?.permissions?.query({ name: 'geolocation' });
    if (permission?.state === 'granted') return await read(nav.geolocation);
    if (permission?.state === 'denied') return { failure: 'Location permission was denied' };
  } catch { /* Unsupported permission inspection must not trigger a prompt. */ }
  return { failure: 'Location permission is unavailable for a foreground check' };
}
