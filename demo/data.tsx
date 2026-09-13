import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type DashboardData = { revenue: number; growth: number; customers: number; points: number[]; activity: { name: string; detail: string; amount: string }[] };
type DashboardContext = { data: DashboardData | null; error: string | null; retry: () => void; period: string; setPeriod: (value: string) => void };
const Context = createContext<DashboardContext | null>(null);
/** SOURCE OF TRUTH: DashboardProvider.
 * WHAT: the demonstration host application's API state and controls.
 * WHY: prove wrappers preserve host providers and data instead of making copies.
 * WHERE: demo components consume this context; src/ never imports demo data.
 */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data,setData]=useState<DashboardData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [attempt,setAttempt]=useState(0);
  const [period,setPeriod]=useState('This month');
  useEffect(()=>{
    const controller = new AbortController();
    setError(null);
    fetch('/api/dashboard', {signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Dashboard data is unavailable.');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>controller.abort();
  },[attempt]);
  return <Context.Provider value={{data,error,retry:()=>setAttempt(v=>v+1),period,setPeriod}}>{children}</Context.Provider>;
}
export function useDashboard() { const state=useContext(Context);if(!state)throw new Error('DashboardProvider is required.');return state; }
