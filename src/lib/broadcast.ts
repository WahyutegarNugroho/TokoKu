const channel = typeof window !== 'undefined' ? new BroadcastChannel('tokoku') : null;

export function broadcast(message: { type: string; payload: unknown }) {
  try { channel?.postMessage(message); } catch { /* BroadcastChannel may be unavailable */ }
}

export function subscribe(handler: (message: { type: string; payload: unknown }) => void) {
  if (!channel) return () => {};
  const cb = (e: MessageEvent) => { handler(e.data); };
  channel.addEventListener('message', cb);
  return () => channel.removeEventListener('message', cb);
}
