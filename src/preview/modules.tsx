import {useEffect,useState,type ComponentType} from 'react';
import {SceneLibrary} from './SceneLibrary';
import {usePreviewConnection,type PreviewHot} from './connection';
/** SOURCE OF TRUTH: SceneModules adapter.
 * WHAT: load explicitly supplied host source modules only for the development library.
 * WHY: normal app entry and production never import authored scene modules.
 * WHERE: host adapter passes lazy module loaders; core load-scene validates metadata.
 */
export type SceneModules=Record<string,()=>Promise<unknown>>;
const pause=()=>{};
export function SceneModuleLibrary({modules,hot,backHref}:{modules:SceneModules;hot?:PreviewHot;backHref?:string}){
 const connection=usePreviewConnection(hot,pause);
 const [retry,setRetry]=useState(0);
 const [state,setState]=useState<{sources:Record<string,unknown>;bindings:Record<string,ComponentType>;error?:string}|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const sources:Record<string,unknown>={};const bindings:Record<string,ComponentType>={};
   try{
    const entries=Object.entries(modules);
    if(entries.length>256)throw new Error('Keep this library at or below 128 scene/component pairs.');
    const results=await Promise.allSettled(entries.map(async([path,loader])=>{
     const value=await loader();const item=value&&typeof value==='object'&&'default' in value?value.default:undefined;
     const normalized=path.replace(/^\//,'');
     if(path.endsWith('.scene.json'))sources[normalized]=item;
     else if(/\.[jt]sx$/.test(path)&&(typeof item==='function'||(typeof item==='object'&&item!==null)))bindings[normalized]=item as ComponentType;
    }));
    const failed=results.find(result=>result.status==='rejected');
    if(failed?.status==='rejected')throw failed.reason;
    if(active)setState({sources,bindings});
   }catch(error){if(active)setState({sources,bindings,error:error instanceof Error?error.message:'Scene source could not be loaded.'})}
  };void load();return()=>{active=false};
 },[modules,retry,connection.generation]);
 if(!state)return <div role="status" style={{padding:40,color:'#eee',background:'#000'}}>Loading your scenes…</div>;
 return <><SceneLibrary sources={state.sources} bindings={state.bindings} hot={hot} backHref={backHref}/>{state.error&&<aside role="alert" style={{position:'fixed',zIndex:20,bottom:60,left:24,right:24,padding:24,borderRadius:20,background:'#252529',color:'#fff'}}>Correct the scene source: {state.error} <button onClick={()=>setRetry(value=>value+1)}>Retry</button></aside>}</>;
}
