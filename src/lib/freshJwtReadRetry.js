// A fresh, valid Supabase Auth token may briefly be rejected by PostgREST
// PGRST303 if its validator's clock is behind token issuance.
// Retry this exact read-only bootstrap error only. Never bypass an identity,
// RLS, MFA or authority failure, or let the UI publish partial profile data.
export function isFreshJwtClockRejection(error) {
  return error?.code === "PGRST303" &&
    /JWT issued at future/i.test(String(error?.message || ""));
}

export async function retryFreshJwtRejection(read, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const delays = [0, 250, 700, 1500];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await wait(delays[attempt]);
    try {
      return await read();
    } catch (error) {
      if (!isFreshJwtClockRejection(error) || attempt === delays.length - 1) throw error;
    }
  }
}
