import { createRoot } from 'react-dom/client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Surface, type PreviewDefinitionInput } from '../../src';
import { ScenePreview } from '../../src/preview';
const Context = createContext('');
const rack = new URLSearchParams(location.search).get("mode") === "focus";
const definition: PreviewDefinitionInput = {width:1400,height:980,
 scene:{camera:{perspective:1800,rotateX:12,rotateY:-18},focus:{distance:1800,fStop:2.8,maxBlur:6},nodes:[{id:'host'}]},
 motion:{durationMs:4000,tracks:[rack ? {target:{kind:'focus'},property:'distance',keyframes:[{timeMs:0,value:1800},{timeMs:4000,value:1560}]} : {target:{kind:'camera'},property:'x',keyframes:[{timeMs:0,value:-100},{timeMs:4000,value:100}]}]},
};
function Host() {
 const context=useContext(Context);const [count,setCount]=useState(0);
 return <article data-testid="host" style={{background:'#ecebea',color:'#28262e',fontFamily:'Arial',padding:40,height:800}}>
 <h2>{context}</h2><button onClick={()=>setCount(value=>value+1)}>Count {count}</button>
 <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:20,marginTop:30}}>
 {Array.from({length:30},(_,index)=><div key={index} style={{padding:18,background:'#fff'}}>Region {index+1}<p>Live text</p></div>)}
 </div></article>;
}
function Fixture() {
 const [invalid,setInvalid]=useState(false);
 const [data,setData]=useState('Loading');
 useEffect(()=>{fetch('/data.json').then(response=>response.json()).then(value=>setData(value.title));},[]);
 const input=useMemo(()=>invalid ? {...definition,scene:{...definition.scene,focus:{distance:-1}}} : definition,[invalid]);
 const children=useMemo(()=><Surface id="host" style={{width:1100,height:880,left:150,top:50}}><Context value={data}><Host/></Context></Surface>,[data]);
 return <><button data-test-only="" onClick={()=>setInvalid(value=>!value)}>{invalid?'Correct source':'Invalid source'}</button>
 <ScenePreview definition={input} title="Host project" hot={import.meta.hot}>{children}</ScenePreview></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
