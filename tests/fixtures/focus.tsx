import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Scene, Surface } from "../../src/react";
function Probe() {
  const [x, setX] = useState(0),
    [pan, setPan] = useState(0),
    [focus, setFocus] = useState(0),
    [tilt, setTilt] = useState(0);
  return (
    <>
      <div style={{ position: "absolute", zIndex: 10 }}>
        <button onClick={() => setX(96)}>Move surface</button>
        <button onClick={() => setPan(96)}>Pan camera</button>
        <button onClick={() => setFocus(96)}>Move focus</button>
        <button onClick={() => setTilt(35)}>Tilt surface</button>
      </div>
      <Scene
        style={{ width: 800, height: 400 }}
        camera={{ x: pan }}
        focus={{ x: focus, radius: 35, falloff: 170, maxBlur: 12 }}
      >
        <Surface
          id="probe"
          transform={{ x, rotateY: tilt }}
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 600,
            height: 300,
          }}
        >
          <div
            style={{
              height: 300,
              background:
                "repeating-linear-gradient(90deg,#fff 0px,#fff 4px,#000 4px,#000 8px)",
            }}
          />
        </Surface>
      </Scene>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Probe />);
