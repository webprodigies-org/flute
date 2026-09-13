import { useState, type ReactNode } from 'react';
import { Scene, Surface, Motion, SceneErrorBoundary } from '../src/react';
import type { SceneIssue } from '../src/core';
import { DashboardProvider, useDashboard } from './data';
import { RevenueCard, CustomersCard, ActivityCard } from './cards';

function Icon({ name }: {name:'grid'|'layers'|'code'|'arrow'}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{name==='grid'?<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>:name==='layers'?<><path d="m12 3 10 6-10 6L2 9 12 3Z"/><path d="m2 13 10 6 10-6M2 17l10 6 10-6"/></>:name==='code'?<><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20"/></>:<path d="M5 12h14m-5-5 5 5-5 5"/>}</svg>;
}
function Slider({label,value,min,max,unit,onChange}:{label:string;value:number;min:number;max:number;unit:string;onChange:(n:number)=>void}) {
  return <label className="slider-label"><span>{label}<output>{value}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function HostDataState({children}:{children:ReactNode}) {
  const {data,error,retry}=useDashboard();
  if(error)return <div className="data-state" role="alert"><h2>Let’s reconnect your dashboard.</h2><p>{error}</p><button className="primary-button" onClick={retry}>Try again</button></div>;
  if(!data)return <div className="data-state" role="status"><span className="loading-orbit"/><p>Loading your components…</p></div>;
  return children;
}
function Study() {
  const [focus,setFocus]=useState('revenue');
  const [tilt,setTilt]=useState(-16);
  const [pitch,setPitch]=useState(10);
  const [depth,setDepth]=useState(180);
  const [blur,setBlur]=useState(8);
  const [flat,setFlat]=useState(false);
  const [showCode,setShowCode]=useState(false);
  const [issues,setIssues]=useState<SceneIssue[]>([]);
  const [revision,setRevision]=useState(0);
  const reset=()=>{setFocus('revenue');setTilt(-16);setPitch(10);setDepth(180);setBlur(8);setFlat(false);setRevision(v=>v+1);};
  const params=new URLSearchParams(window.location.search);
  const fixture=params.get('fixture');
  if(fixture==='baseline')return <DashboardProvider><HostDataState><div className="baseline"><RevenueCard/><CustomersCard/><ActivityCard/></div></HostDataState></DashboardProvider>;
  const targets=[{id:'revenue',label:'Revenue overview',depth:0},{id:'customers',label:'Customer card',depth},{id:'activity',label:'Recent activity',depth:-130}];
  return <DashboardProvider><div className="app-shell">
    <aside className="rail"><a href="/" className="brand-mark" aria-label="Flute home">f<span>·</span></a><div className="rail-actions"><button className="rail-active" aria-label="Surface study"><Icon name="layers"/></button><button aria-label="Show scene code" onClick={()=>setShowCode(v=>!v)} aria-pressed={showCode}><Icon name="code"/></button></div><span className="rail-foot">01</span></aside>
    <div className="workspace">
      <header className="topbar"><div className="wordmark">flute<span className="divider">/</span><span className="project-name">Surface study</span><span className="local-badge"><i/>Local</span></div><button className="source-link" onClick={()=>setShowCode(v=>!v)} aria-expanded={showCode}>Scene source <Icon name="code"/></button></header>
      <main className="main-layout">
        <section className="canvas-area">
          <div className="canvas-title"><div><p className="eyebrow">YOUR INTERFACE. A NEW DIMENSION.</p><h1>Give your product<br/><em>a little perspective.</em></h1><p className="intro">Real components. Real data. A different point of view.</p></div><span className="study-number">STUDY — 001</span></div>
          <div className={'stage-frame'+(flat?' flat-view':'')}>
            <div className="stage-grid" aria-hidden="true"/><div className="stage-glow" aria-hidden="true"/>
            <div className="stage-label"><span className="tiny-cross">+</span> NORTHSTAR / DASHBOARD</div>
            <HostDataState><SceneErrorBoundary resetKey={revision}>
              <Scene className="scene" camera={{perspective:1600,rotateX:flat?0:pitch,rotateY:flat?0:tilt,rotateZ:flat?0:-3}} focus={{targetId:fixture==='missing'?'missing':focus,range:24,falloff:32,maxBlur:flat?0:blur}} onDiagnostics={setIssues}>
                <Surface id="composition" className="composition">
                  <Surface id="revenue" className="revenue-surface"><RevenueCard/></Surface>
                  <Motion id={fixture==='duplicate'?'revenue':'customers'} transform={{z:flat?0:depth}} className="customers-surface"><CustomersCard/></Motion>
                  <Surface id="activity" transform={{z:flat?0:-130}} className="activity-surface"><ActivityCard/></Surface>
                </Surface>
              </Scene>
            </SceneErrorBoundary></HostDataState>
            <div className="stage-bottom"><span><i/>LIVE COMPONENTS</span><span>DOM / PERSPECTIVE</span></div>
          </div>
          <div className="canvas-footer"><div className="view-switch"><button onClick={()=>setFlat(false)} className={!flat?'selected':''} aria-pressed={!flat}><Icon name="layers"/> Perspective</button><button onClick={()=>setFlat(true)} className={flat?'selected':''} aria-pressed={flat}><Icon name="grid"/> Flat</button></div><span className="canvas-hint">Interact with the cards. They’re still your app.</span></div>
          {showCode&&<section className="code-panel" aria-label="Scene source"><div><strong>Your scene, in code</strong><button onClick={()=>setShowCode(false)} aria-label="Close scene source">×</button></div><pre>{`<Scene camera={{ rotateY: ${tilt} }}\n       focus={{ targetId: "${focus}" }}>\n  <Surface id="revenue">\n    <RevenueCard />\n  </Surface>\n  <Motion id="customers" transform={{ z: ${depth} }}>\n    <CustomersCard />\n  </Motion>\n</Scene>`}</pre></section>}
        </section>
        <aside className="inspector" aria-label="Surface controls">
          <div className="inspector-heading"><div><span className="eyebrow">COMPOSITION</span><h2>Find your focus.</h2></div><span className="focus-icon">⌖</span></div>
          <p className="inspector-intro">Bring one detail forward.<br/>Let the rest fall into place.</p>
          <section className="control-section"><div className="section-heading"><h3>Focal point</h3><span>01</span></div><div className="focus-options">{targets.map(t=><button key={t.id} onClick={()=>setFocus(t.id)} aria-pressed={focus===t.id} className={focus===t.id?'is-focused':''}><span className="radio-dot"/><span>{t.label}</span><small>{t.depth>0?'+':''}{t.depth}z</small></button>)}</div></section>
          <section className="control-section"><div className="section-heading"><h3>Perspective</h3><span>02</span></div><Slider label="Horizontal tilt" value={tilt} min={-35} max={35} unit="°" onChange={setTilt}/><Slider label="Vertical tilt" value={pitch} min={-25} max={25} unit="°" onChange={setPitch}/></section>
          <section className="control-section"><div className="section-heading"><h3>Depth & clarity</h3><span>03</span></div><Slider label="Customer depth" value={depth} min={-200} max={300} unit="px" onChange={setDepth}/><Slider label="Maximum blur" value={blur} min={0} max={12} unit="px" onChange={setBlur}/></section>
          <button className="reset-button" onClick={reset}>↺ <span>Reset composition</span></button>
          <div className="inspector-note"><span>✳</span><p>Wrapped, never recreated.<br/><strong>Your components stay connected.</strong></p></div>
          {issues.length>0&&<div className="diagnostics" role="status">{issues.map((issue,i)=><p key={i}>{issue.message}</p>)}</div>}
        </aside>
      </main>
      <footer className="bottom-bar"><span><i/> Rendered locally</span><span>SCENE / SURFACE / MOTION</span><span>Flute · First surface</span></footer>
    </div>
  </div></DashboardProvider>;
}
export default Study;
