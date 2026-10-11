// Independent dataset reads may reject during network/auth transitions.
// A single rejected read must not strand the attendance console in Loading.
export async function settleWorkforceDatasets(datasets) {
  return Promise.all((Array.isArray(datasets) ? datasets : []).map(async ([name, query]) => {
    try {
      const result = await query;
      return { name, data: result?.data ?? null, error: result?.error ?? null };
    } catch (error) {
      return { name, data: null, error };
    }
  }));
}
