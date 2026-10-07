import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { request, readableError } from './api';
import { getParticipants } from './participant';
export type Account = { id: string; fullName: string; telegram: string };
export type Enrollment = { id: string; eventId: string; displayName: string; status: string; submissions: number; score: number | null };
export type AuthData = { user: Account | null; registrations: Enrollment[] };
const AuthContext = createContext<{ data: AuthData; checking: boolean; error: string; refresh: () => Promise<void> }>({ data: { user:null, registrations:[] }, checking:true, error:'', refresh:async()=>{} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [data,setData] = useState<AuthData>({user:null,registrations:[]});
  const [checking,setChecking] = useState(true), [error,setError] = useState('');
  const location = useLocation();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try { const result = await request<AuthData>('/api/auth/me'); if (current === generation.current) {setData(result); setError('');} }
    catch (failure) { if (current === generation.current) {setData({user:null,registrations:[]}); setError(readableError(failure));} }
    finally { if (current === generation.current) setChecking(false); }
  },[]);
  useEffect(() => { void getParticipants().catch(() => {}); },[]);
  useEffect(() => { void refresh(); },[refresh,location.pathname]);
  useEffect(() => { const update = () => { void refresh(); }; window.addEventListener('focus',update); return () => window.removeEventListener('focus',update); },[refresh]);
  return <AuthContext.Provider value={{data,checking,error,refresh}}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
