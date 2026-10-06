export function getPositionOnce(geo = globalThis.navigator?.geolocation) {
  return new Promise((resolve) => {
    if (!geo) return resolve({ failure: "Location is unavailable on this device" });
    let settled = false;
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const timer = setTimeout(() => finish({ failure: "Location request timed out" }), 8000);
    try { geo.getCurrentPosition((position) => {
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
          || !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 120000) {
        return finish({ failure: "A fresh valid location could not be obtained" });
      }
      finish({ lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
        capturedAt: new Date(position.timestamp).toISOString() });
    }, (error) => finish({ failure: error.code === 1 ? "Location permission was denied" : "Location could not be obtained" }),
    { timeout: 7500, maximumAge: 0, enableHighAccuracy: true });
    } catch { finish({ failure: "Location could not be obtained" }); }
  });
}
