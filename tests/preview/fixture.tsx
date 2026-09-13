import { createRoot } from "react-dom/client";
import { createContext, useContext, useState } from "react";
import { ProjectPreview } from "../../src/preview";

const HostData = createContext("");
function Application() {
  const name = useContext(HostData);
  const [count, setCount] = useState(0);
  return <main style={{ background: "white", minHeight: "65vh", padding: 24, fontFamily: "system-ui" }}>
    <h1>{name}</h1>
    <p>This existing application keeps its providers and interactions.</p>
    <button onClick={() => setCount(count + 1)}>Count {count}</button>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 32 }}>
      {["Overview", "Activity", "Projects"].map(title => <article key={title} style={{ border: "1px solid #ddd", padding: 16 }}><h2>{title}</h2><p>Live application content</p></article>)}
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(
  <ProjectPreview projectId="fixture" enabled={import.meta.env.DEV}>
    <HostData.Provider value="Your workspace"><Application /></HostData.Provider>
  </ProjectPreview>,
);
