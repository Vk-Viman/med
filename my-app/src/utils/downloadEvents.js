// Lightweight event bus to signal when offline downloads change
// Avoids bringing in external deps; works across components.

const subs = new Set();

export function addDownloadListener(fn) {
  if (typeof fn !== 'function') return () => {};
  subs.add(fn);
  return () => { try { subs.delete(fn); } catch {} };
}

export function notifyDownloadChanged() {
  subs.forEach((fn) => {
    try { fn(); } catch {}
  });
}
