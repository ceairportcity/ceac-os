// Keep the existing phone design, including hidden desktop panels and compact
// navigation. WebKit can restore a 980px layout viewport on a 390px handset;
// narrowing its frame alone leaves the wrong @media composition active.
// Resolve only width terms against that handset, in the ORIGINAL rules/order.
// Colour scheme, motion, print and native matchMedia are left to the browser.
export function phoneMediaQuery(query, width) {
  if (!Number.isFinite(width) || width <= 0) return query;
  return query.replace(/\(\s*(?:(min|max)-)?(?:device-)?width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/gi,
    (_term, bound, value) => {
      const limit = Number(value);
      const matches = bound === 'min' ? width >= limit : bound === 'max' ? width <= limit : width === limit;
      return matches ? '(min-width: 0px)' : '(max-width: 0px)';
    });
}

export function createPhoneMedia(document) {
  const originals = new WeakMap();
  let currentWidth = null;
  function visit(rules, width) {
    for (const rule of rules) {
      if (rule.type === 4 && rule.media) {
        const original = originals.get(rule) ?? rule.media.mediaText;
        originals.set(rule, original);
        const next = phoneMediaQuery(original, width);
        if (next !== rule.media.mediaText) rule.media.mediaText = next;
      }
      if (rule.cssRules) visit(rule.cssRules, width);
    }
  }
  return {
    sync(width, force = false) {
      if (width === currentWidth && !force) return;
      if (width === null && currentWidth === null) return;
      currentWidth = width;
      for (const sheet of document.styleSheets || []) {
        // Cross-origin provider sheets are not ours and may deny CSSOM reads.
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        if (rules) visit(rules, width);
      }
    },
  };
}
