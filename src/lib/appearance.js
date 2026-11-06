export const APPEARANCE_KEY = 'ceac.appearance';
export const appearanceOptions = ['system', 'light', 'dark'];
export function readAppearance(storage) {
  try { const value = (storage || globalThis.localStorage).getItem(APPEARANCE_KEY); return appearanceOptions.includes(value) ? value : 'system'; }
  catch { return 'system'; }
}
export function applyAppearance(value, {persist = true} = {}) {
  const mode = appearanceOptions.includes(value) ? value : 'system';
  const dark = mode === 'dark' || mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.appearance = mode;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  if (persist) { try { if (mode === 'system') localStorage.removeItem(APPEARANCE_KEY); else localStorage.setItem(APPEARANCE_KEY, mode); } catch { /* Still works for this visit. */ } }
  window.dispatchEvent(new Event('ceac:appearance'));
  return mode;
}
export function initialiseAppearance() {
  applyAppearance(readAppearance(), {persist:false});
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', () => { if (document.documentElement.dataset.appearance === 'system') applyAppearance('system', {persist:false}); });
  window.addEventListener('storage', event => { if (event.key === APPEARANCE_KEY || event.key === null) applyAppearance(readAppearance(), {persist:false}); });
}
