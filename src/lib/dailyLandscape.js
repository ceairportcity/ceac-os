/**
 * Deterministic Ghana-local daily banner rotation.
 * Accepts ten locally hosted, licence-verified image manifest entries.
 * No network dependency and no random rerender changes within a Ghana day.
 */
const DAY_MS = 86400000;
export function ghanaCalendarDate(instant = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid instant');
  // Ghana's civil time is UTC (Africa/Accra); no daylight-saving transition.
  return date.toISOString().slice(0, 10);
}
export function dailyLandscapeIndex(ghanaDate, count = 10, anchorDate = '2026-10-16') {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Expected YYYY-MM-DD');
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
    return parsed.getTime();
  };
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid image count');
  const days = Math.round((parse(ghanaDate) - parse(anchorDate)) / DAY_MS);
  return ((days % count) + count) % count;
}
export function selectDailyLandscape(manifest, instant = new Date()) {
  if (!Array.isArray(manifest) || manifest.length !== 10) throw new Error('Exactly ten verified images required');
  for (const image of manifest) {
    if (!image || !image.src?.startsWith('/') || !image.sourceUrl?.startsWith('https://') || !image.licenseUrl?.startsWith('https://') || !image.photographer) {
      throw new Error('Incomplete local image or licence provenance');
    }
  }
  return manifest[dailyLandscapeIndex(ghanaCalendarDate(instant), manifest.length)];
}
