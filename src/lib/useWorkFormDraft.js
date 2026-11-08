import { useLayoutEffect, useRef, useState } from "react";
import { clearAccountCommunicationDrafts as clearEncryptedAccountDrafts, clearLocalMemoDraft, readLocalMemoDraft, saveLocalMemoDraft } from "./memoLocalDrafts";

const writes = new Map();
const accountEpochs = new Map();

function inOrder(account, operation) {
  const next = (writes.get(account) || Promise.resolve()).catch(() => {}).then(operation);
  writes.set(account, next);
  const clean = () => { if (writes.get(account) === next) writes.delete(account); };
  next.then(clean, clean);
  return next;
}

export function clearAccountCommunicationDrafts(orgId, userId) {
  const account = `${orgId}:${userId}`;
  accountEpochs.set(account, Symbol());
  return inOrder(account, () => clearEncryptedAccountDrafts(orgId, userId));
}

// Text and form choices stay on this device. Files must be selected again.
export const workDraftStorageError = "Draft recovery is unavailable on this device. Save your changes before leaving.";

export function useWorkFormDraft(me, slot, fields, restore) {
  const account = `${me.org_id}:${me.id}`;
  const draftId = `${me.id}:work-form:${slot}`;
  const scope = `${account}:${slot}`;
  const [loadedScope, setLoadedScope] = useState("");
  const [failedScope, setFailedScope] = useState("");
  const [restoredScope, setRestoredScope] = useState("");
  const epoch = accountEpochs.get(account);
  const snapshot = slot ? JSON.stringify(fields) : "";
  const current = useRef(snapshot);
  const readyScope = useRef("");
  const committed = useRef("");
  const pending = useRef(null);
  const writing = useRef(null);
  const apply = useRef(restore);
  apply.current = restore;

  function flush() {
    const entry = pending.current;
    if (entry?.scope !== scope) return;
    pending.current = null;
    if (epoch !== accountEpochs.get(account)) return;
    const write = inOrder(account, () => saveLocalMemoDraft(me.org_id, draftId, entry.fields));
    writing.current = { scope, write };
    function finish() { if (writing.current?.write === write) writing.current = null; }
    write.then(() => {
      finish();
      setFailedScope((failed) => failed === scope ? "" : failed);
    }, () => {
      finish();
      setFailedScope(scope);
    });
  }

  useLayoutEffect(() => {
    let active = true;
    readyScope.current = "";
    setLoadedScope("");
    setFailedScope("");
    setRestoredScope("");
    current.current = snapshot;
    committed.current = "";
    if (!slot || !me.org_id || !me.id) return;
    inOrder(account, () => readLocalMemoDraft(me.org_id, draftId)).then((saved) => {
      if (!active || epoch !== accountEpochs.get(account)) return;
      if (saved?.fields) {
        const restored = { ...fields, ...saved.fields };
        committed.current = JSON.stringify(restored);
        apply.current(restored);
        setRestoredScope(scope);
      } else {
        committed.current = current.current;
      }
      readyScope.current = scope;
      setLoadedScope(scope);
    }, () => {
      if (!active || epoch !== accountEpochs.get(account)) return;
      committed.current = current.current;
      setFailedScope(scope);
      readyScope.current = scope;
      setLoadedScope(scope);
    });
    function onHidden() { if (document.hidden) flush(); }
    function beforeUnload(event) {
      const hasUnfinishedWrite = pending.current?.scope === scope || writing.current?.scope === scope;
      if (!hasUnfinishedWrite) return;
      flush();
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      flush();
    };
  }, [scope, epoch]);

  useLayoutEffect(() => {
    current.current = snapshot;
    if (!slot || readyScope.current !== scope || loadedScope !== scope || snapshot === committed.current) return;
    committed.current = snapshot;
    pending.current = { scope, fields: { fields } };
    const timer = window.setTimeout(flush, 180);
    return () => window.clearTimeout(timer);
  }, [scope, loadedScope, snapshot]);

  function clear(nextFields = fields) {
    if (pending.current?.scope === scope) pending.current = null;
    committed.current = JSON.stringify(nextFields);
    setRestoredScope((restored) => restored === scope ? "" : restored);
    if (epoch !== accountEpochs.get(account)) return Promise.resolve();
    return inOrder(account, () => clearLocalMemoDraft(me.org_id, draftId)).catch(() => {});
  }

  const failed = Boolean(slot && failedScope === scope);
  const notice = failed ? workDraftStorageError : slot && restoredScope === scope ? "Draft restored" : "";
  return { ready: !slot || loadedScope === scope, failed, notice, clear };
}
