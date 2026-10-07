import { mutate, request } from './api';
export type Participant = { eventId: string; displayName: string };
let migration: Promise<void> | undefined;

// Exchange credentials saved by the previous site version without asking the user to copy them.
async function migratePreviousVersion() {
  for (const eventId of ['start', 'vibe']) {
    let legacy: string | null = null;
    try { legacy = localStorage.getItem(`suai-receipt-${eventId}`); } catch { /* Cookies work without localStorage. */ }
    if (!legacy) continue;
    try {
      await mutate('/api/participant/migrate', { eventId, token: legacy });
      localStorage.removeItem(`suai-receipt-${eventId}`);
    } catch { /* Keep an old credential on network failure; recovery remains available. */ }
  }
}
export async function getParticipants() {
  migration ??= migratePreviousVersion();
  await migration;
  return request<{ participants: Participant[] }>('/api/participant');
}
