import {useEffect,useMemo,useRef,useState,type ComponentType,type MouseEvent} from 'react';
import {FLUTE_BRAND,RESOURCES,motionDuration,matrixFor,TransformSchema} from '../core';
import {Scene,Surface,SceneErrorBoundary} from '../react';
import {ScenePreview} from './ScenePreview';
import type {PreviewHot} from './connection';
import {BrandAttribution} from './BrandAttribution';
import {GettingStarted} from './GettingStarted';
import {libraryTheme} from './library-theme';

/** SOURCE OF TRUTH: SceneLibrary.
 * WHAT: list and navigate the host's validated source recipes through one catalog.
 * Projected row visibility and centered scroll endpoints belong to this list layout.
 * WHY: discovered files, deep links and CLI reopening share load-scene validation.
 * WHERE: ProjectPreview supplies Vite modules; ScenePreview owns selected playback.
 */
export type SceneLibraryProps={sources?:Record<string,unknown>;bindings?:Record<string,ComponentType>;hot?:PreviewHot;backHref?:string};
const EMPTY_SOURCES:Record<string,unknown>={};
const EMPTY_BINDINGS:Record<string,ComponentType>={};
const ROW=150;
// Positive X tilt recedes at the top and approaches the viewer at the bottom.
// The lens stays fixed at the viewport center while the entire list travels through it.
const camera={perspective:1400,rotateX:42};
const focus={distance:1400,fStop:4,focalLength:220,maxBlur:7};
const view=matrixFor(TransformSchema.parse({rotateX:camera.rotateX}));
// Viewport culling consumes the canonical camera matrix, not flat scroll indices.
// Invert the projected vertical coordinate on this list's z=0 plane. Keep a full
// row plus the blur footprint beyond each edge; a visible horizon retains its tail.
function visibleRows(scroll:number,height:number,count:number){
 const localY=(screenY:number)=>{
  const y=screenY-height/2;
  const denominator=camera.perspective*view[5]+y*view[9];
  return denominator<=0?-Infinity:height/2+y*camera.perspective/denominator;
 };
 const top=localY(-3*focus.maxBlur);
 const bottom=localY(height+3*focus.maxBlur);
 return {start:Math.max(0,Math.floor((scroll+top-(height/2-ROW/2))/ROW)-1),
  end:Math.min(count,Math.ceil((scroll+bottom-(height/2-ROW/2))/ROW)+2)};
}
// Image failures are local to the thumbnail; a replacement source retries naturally.
function SnapshotImage({src}:{src:string}){
 const [failed,setFailed]=useState<string>();
 return failed===src?null:<img src={src} alt="" loading="lazy" decoding="async" onError={()=>setFailed(src)}/>;
}
function selection(){return typeof location==='undefined'?undefined:new URL(location.href).searchParams.get('flute-scene')??undefined;}
export function SceneLibrary({sources=EMPTY_SOURCES,bindings=EMPTY_BINDINGS,hot,backHref}:SceneLibraryProps){
 const [sceneId,setSceneId]=useState(selection);
 const [scroll,setScroll]=useState(0);
 const [size,setSize]=useState({width:1200,height:1000});
 const {width,height}=size;
 const scroller=useRef<HTMLDivElement>(null);
 const savedScroll=useRef(0);
 const catalog=useMemo(()=>RESOURCES['resolve-recipes']({sources:Object.entries(sources).map(([path,document])=>({path,document})),bindingPaths:Object.keys(bindings),...(sceneId?{sceneId}:{})}),[sources,bindings,sceneId]);
 const selected=catalog.selected;
 const Component=selected?bindings[selected.binding]:undefined;
 const content=useMemo(()=>Component?<Component/>:null,[Component]);
 useEffect(()=>{const pop=()=>setSceneId(selection());window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{if(selected&&Component)return;const element=scroller.current;if(!element)return;const measure=()=>setSize({width:element.clientWidth,height:element.clientHeight});const observer=new ResizeObserver(measure);observer.observe(element);measure();element.scrollTop=savedScroll.current;return()=>observer.disconnect()},[selected?.id,Component]);
 const destination=(id?:string)=>{const url=new URL(location.href);if(id)url.searchParams.set('flute-scene',id);else url.searchParams.delete('flute-scene');return url.pathname+url.search+url.hash;};
 const navigate=(event:MouseEvent<HTMLAnchorElement>,id?:string)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();history.pushState({},'',destination(id));setSceneId(id);};
 if(selected&&Component)return <ScenePreview key={selected.id} definition={selected.definition} title={selected.title} backHref={destination()} onBack={()=>{history.pushState({},'',destination());setSceneId(undefined)}} hot={hot}>{content}</ScenePreview>;
 const planeWidth=Math.min(940,Math.max(320,width-64));
 const {start,end}=visibleRows(scroll,height,catalog.scenes.length);
 return <main data-flute-library=""><style>{libraryTheme}</style>
  <div className="flute-library-top"><div className="flute-library-identity"><a href={destination()} onClick={event=>navigate(event)} className="flute-library-brand">{FLUTE_BRAND.name.toLowerCase()}</a><BrandAttribution showName={false}/></div>{backHref&&<a href={backHref}>Back to app</a>}</div>
  {sceneId&&<div className="flute-library-notice" role="alert">This scene cannot be opened. Correct its source or <a href={destination()} onClick={event=>navigate(event)}>return to scenes</a>.</div>}
  {catalog.issues.length>0&&<details className="flute-library-issues"><summary>Some scene sources need attention ({catalog.issues.length})</summary><ul>{catalog.issues.map((issue,index)=><li key={index}>{issue.path}: {issue.message}</li>)}</ul></details>}
  {catalog.scenes.length===0?<section className="flute-library-empty"><div><span>YOUR SCENE LIBRARY</span><h1>A place for every perspective.</h1><p>Your app’s scenes appear here as your coding agent creates them.</p><GettingStarted label="Connect your first scene"/></div></section>:
   <div ref={scroller} className="flute-library-scroll" role="region" aria-label="Scenes" tabIndex={0} onScroll={event=>{savedScroll.current=event.currentTarget.scrollTop;setScroll(event.currentTarget.scrollTop)}}>
    <div style={{height:`calc(100svh + ${Math.max(0,(catalog.scenes.length-1)*ROW)}px)`}}>
     <div className="flute-library-stage">
      <SceneErrorBoundary><Scene camera={camera} focus={focus} style={{width:'100%',height:'100%'}}>
       <Surface id="scene-list" transform={{y:-scroll}} style={{position:'absolute',left:(width-planeWidth)/2,top:height/2-110-ROW/2,width:planeWidth,height:1}}>
        <Surface id="scene-list-heading" style={{position:'absolute',top:0,width:planeWidth,height:110}}><header className="flute-library-heading"><h1>Your scenes</h1><span>{catalog.scenes.length} perspectives</span></header></Surface>
        {catalog.scenes.slice(start,end).map((scene,index)=>{const number=start+index;return <Surface key={scene.id} id={`scene-row-${scene.id}`} style={{position:'absolute',top:110+number*ROW,width:planeWidth,height:ROW}}>
          <a className="flute-scene-row" data-scene-id={scene.id} onFocus={event=>{if(event.currentTarget.matches(':focus-visible')&&scroller.current)scroller.current.scrollTop=Math.max(0,number*ROW)}} href={destination(scene.id)} onClick={event=>navigate(event,scene.id)}>
           <span className="flute-scene-number">{String(number+1).padStart(2,'0')}{scene.snapshot&&<SnapshotImage src={scene.snapshot.image}/>}</span><span className="flute-scene-copy"><strong>{scene.title}</strong><span>{scene.description||'A new perspective on your product'}</span></span>
           <span className="flute-scene-duration">{Math.round((scene.definition.motion?motionDuration(scene.definition.motion):0)/1000)}s <span aria-hidden="true">↗</span></span>
          </a>
         </Surface>})}
       </Surface>
      </Scene></SceneErrorBoundary>
     </div>
    </div>
   </div>}
  {catalog.scenes.length>0&&<p className="flute-library-hint">Scroll to explore · Select a scene to watch</p>}
 </main>;
}
