import { useEffect, useState } from 'react';
import eventDefinitions from '../shared/events.json';
import { request } from './api';
import type { HackEvent } from './types';

export const fallbackEvents = eventDefinitions as HackEvent[];
export function useEvents() {
  const [events, setEvents] = useState<HackEvent[]>(fallbackEvents);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => request<{ events: HackEvent[] }>('/api/events').then(response => {
      if (active) { setEvents(response.events); setVerified(true); }
    }).catch(() => { if (active) setVerified(false); });
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return { events, verified };
}
