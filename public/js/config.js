// Where the Node server (online races + shared leaderboard) lives.
// Run with `npm start`, the page talks to the server it came from.
// Published as static files (GitHub Pages), it talks to REMOTE_SERVER instead (see render.yaml).
const REMOTE_SERVER = "https://lagos-traffic-survivor.onrender.com";

export const STATIC_HOST = location.hostname.endsWith("github.io");
export const SERVER = STATIC_HOST ? REMOTE_SERVER.replace(/\/+$/, "") : location.origin;
export const apiUrl = (path) => SERVER + path;
export const wsUrl = () => `${SERVER.replace(/^http/, "ws")}/ws`;

/** Free Render servers sleep when idle; this wakes one up (can take up to a minute). */
export async function wakeServer(timeoutMs = 75000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl("/api/health"), { signal: ctrl.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
