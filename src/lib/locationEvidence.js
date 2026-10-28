export function getPositionOnce(geo = globalThis.navigator?.geolocation) {
  return new Promise((resolve) => {
    if (!geo) return resolve({ failure: "Location is unavailable on this device" });
    let settled = false, attempt = 0, attemptTimer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(attemptTimer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ failure: "Location request timed out" }), 15000);
    const request = (enableHighAccuracy) => {
      const requestId = ++attempt;
      clearTimeout(attemptTimer);
      const fail = (error) => {
        if (settled || requestId !== attempt) return;
        clearTimeout(attemptTimer);
        if (error?.code === 1) return finish({ failure: "Location permission was denied" });
        if (enableHighAccuracy) return request(false);
        finish({ failure: error?.code === 3 ? "Location request timed out" : "Location could not be obtained" });
      };
      // Own watchdog also covers browsers that never call their timeout handler.
      // Ignore a late callback from the high-accuracy request after fallback.
      attemptTimer = setTimeout(() => fail({ code: 3 }), 6500);
      try {
        geo.getCurrentPosition((position) => {
          if (settled || requestId !== attempt) return;
          const { latitude: lat, longitude: lng, accuracy } = position?.coords || {};
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
              || !Number.isFinite(position?.timestamp) || Math.abs(Date.now() - position.timestamp) > 120000) {
            return fail({ code: 2 });
          }
          finish({ lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
            capturedAt: new Date(position.timestamp).toISOString() });
        }, fail, { timeout: 6500, maximumAge: 0, enableHighAccuracy });
      } catch { fail({ code: 2 }); }
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
