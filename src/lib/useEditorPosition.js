import { useState } from "react";

// The history entry stores only navigation choices. Draft content stays encrypted.
export function useEditorPosition(me, name, fallback) {
  const key = me ? `${me.org_id}:${me.id}:${me.unit_id || ""}:${name}` : "";
  const url = window.location.href;
  const scope = `${key}:${url}`;
  const [position, setPosition] = useState(null);
  const saved = key ? window.history.state?.ceacEditors?.[key] : undefined;
  const value = position?.scope === scope ? position.value : saved ?? fallback;

  function set(value, navigation = false) {
    if (key && (navigation || window.location.href === url)) {
      try {
        const state = window.history.state || {};
        const ceacEditors = { ...state.ceacEditors };
        if (value === null || value === false || value === "") delete ceacEditors[key];
        else ceacEditors[key] = value;
        window.history.replaceState({ ...state, ceacEditors }, "");
      } catch { /* The editor still works when browser state is unavailable. */ }
    }
    setPosition({ scope, value });
  }

  return [value, set];
}

export function clearEditorPositions(me) {
  try {
    const state = window.history.state;
    if (!state?.ceacEditors) return;
    const prefix = `${me.org_id}:${me.id}:`;
    const ceacEditors = Object.fromEntries(Object.entries(state.ceacEditors)
      .filter(([key]) => !key.startsWith(prefix)));
    window.history.replaceState({ ...state, ceacEditors }, "");
  } catch { /* Draft content is cleared separately from these markers. */ }
}
