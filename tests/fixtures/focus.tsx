import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Scene, Surface } from "../../src/react";
function Probe() {
  const [x, setX] = useState(0),
    [pan, setPan] = useState(0),
    [focus, setFocus] = useState(1400),
    [tilt, setTilt] = useState(45);
  return (
    <>
      <div style={{ position: "absolute", zIndex: 10 }}>
        <button onClick={() => setX(96)}>Move surface</button>
        <button onClick={() => setPan(96)}>Pan camera</button>
        <button onClick={() => setFocus(1250)}>Move focus</button>
        <button onClick={() => setTilt(0)}>Tilt surface</button>
      </div>
      <Scene
        style={{ width: 800, height: 400 }}
        camera={{ x: pan }}
        focus={{ distance: focus, fStop:1.4, focalLength:150, maxBlur:6 }}
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
function Planes() {
  return <Scene style={{width:800,height:400}} focus={{distance:1400,fStop:1.4,focalLength:150,maxBlur:6}}>
    <Surface id="group" style={{height:400}}>
      {[{id:"left",x:80,z:0},{id:"right",x:310,z:0},{id:"background",x:580,z:-500}].map(p=><Surface key={p.id} id={p.id} transform={{z:p.z}} style={{position:"absolute",left:p.x,top:140,width:100,height:100}}><div data-testid={p.id} style={{height:100,background:"repeating-linear-gradient(90deg,#fff 0px,#fff 4px,#000 4px,#000 8px)"}} /></Surface>)}
    </Surface>
  </Scene>;
}
createRoot(document.getElementById("root")!).render(location.search.includes("planes") ? <Planes/> : <Probe />);
