// Protect confidential employee detail and signed-file work from stale responses.
// This is a UI boundary; the database and private Storage remain authoritative.
export function createProtectedHrRequestScope() {
  let employeeId = null;
  let generation = 0;
  return {
    select(id) {
      employeeId = id || null;
      generation += 1;
    },
    begin(id) {
      if (!id || employeeId !== id) return null;
      return { employeeId: id, generation: ++generation };
    },
    snapshot() {
      return { employeeId, generation };
    },
    matches(token) {
      return Boolean(token) && token.employeeId === employeeId && token.generation === generation;
    },
  };
}
