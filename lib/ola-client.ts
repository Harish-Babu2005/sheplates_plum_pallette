// Browser side of the Ola map: asks our server how to load it (a short-lived token, or a restricted public key),
// keeps that token fresh, and says when the standard map should be used instead.
export type OlaAccess = { enabled: true; auth: "token" | "key"; token?: string; key?: string; expiresAt: number; base: string; style: string };
type Reply = { enabled: boolean; auth?: "token" | "key"; token?: string; key?: string; expiresIn?: number; base?: string; style?: string };

let current: OlaAccess | null = null;
let loading: Promise<OlaAccess | null> | null = null;

async function fetchAccess(): Promise<OlaAccess | null> {
  try {
    const res = await fetch("/api/ola/token", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const j = (await res.json()) as Reply;
    if (!j.enabled || !j.auth || !j.base || !j.style) return null;
    return { enabled: true, auth: j.auth, token: j.token, key: j.key, base: j.base, style: j.style, expiresAt: Date.now() + (j.expiresIn ? j.expiresIn * 1000 : 24 * 3_600_000) };
  } catch { return null; }
}

/** Resolves once per page load; null means "use the standard map". */
export function loadOlaAccess(): Promise<OlaAccess | null> {
  if (current && current.expiresAt - 60_000 > Date.now()) return Promise.resolve(current);
  loading ||= fetchAccess().then((a) => { current = a; return a; }).finally(() => { loading = null; });
  return loading;
}
/** What to attach to a map request right now. Starts a refresh when the token is close to expiring. */
export function olaAuthNow(): { token?: string; key?: string } {
  if (current && current.auth === "token" && current.expiresAt - 90_000 < Date.now()) void loadOlaAccess();
  return { token: current?.token, key: current?.key };
}
/** Forget the saved access (for example after the provider rejected it), so the next map asks again. */
export function resetOlaAccess() { current = null; }
