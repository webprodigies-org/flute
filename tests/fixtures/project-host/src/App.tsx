import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
const DashboardContext = createContext(0);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [revenue, setRevenue] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/value", {signal:controller.signal}).then(r=>r.json()).then(v=>setRevenue(v.revenue)).catch(()=>{});
    return () => controller.abort();
  }, []);
  return <DashboardContext.Provider value={revenue}>{children}</DashboardContext.Provider>;
}
export function App() {
  const revenue = useContext(DashboardContext);
  const [count, setCount] = useState(0);
  return <main style={{padding:32,minHeight:320,background:"#eff6ef",color:"#183a25",fontFamily:"system-ui"}}>
    <h1>Existing revenue dashboard</h1>
    <p data-testid="host-revenue">Revenue: {revenue}</p>
    <button onClick={()=>setCount(c=>c+1)}>Inspect {count}</button>
  </main>;
}
