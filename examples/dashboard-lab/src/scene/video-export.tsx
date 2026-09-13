import { useEffect, useState } from "react"
import { ExportFrameRateSchema, SUPPORTED_EXPORT_FPS } from "@flute/scene"

// The CLI owns capture and publication. This small example panel exposes its
// command and completed local files; it does not create an unauthenticated server.
export function VideoExport({ cascade }: { cascade:boolean }) {
  const [fps,setFps]=useState(60)
  const [available,setAvailable]=useState(false)
  const [copied,setCopied]=useState(false)
  const file=`/exports/sidebar-${fps}.mp4`
  useEffect(()=>{
    const controller=new AbortController()
    setAvailable(false)
    fetch(file,{method:"HEAD",signal:controller.signal}).then(response=>{
      setAvailable(response.ok && !!response.headers.get("content-type")?.startsWith("video/"))
    }).catch(()=>{})
    return ()=>controller.abort()
  },[file])
  const url=new URL(window.location.href)
  url.searchParams.delete("flute-preview")
  url.searchParams.set("cascade",cascade?"1":"0")
  const quote=(value:string)=>"'"+value.replaceAll("'", "'\\''")+"'"
  const command=`npx flute export --url ${quote(url.href)} --output sidebar-${fps}.mp4 --fps ${fps}`
  return <details className="export-panel"><summary>Export MP4</summary>
    <div><label>Export frame rate <select aria-label="Export frame rate" value={fps} onChange={e=>{setFps(ExportFrameRateSchema.parse(Number(e.target.value)));setCopied(false)}}>{SUPPORTED_EXPORT_FPS.map(rate=><option key={rate} value={rate}>{rate} FPS</option>)}</select></label>
      {available && cascade && <a href={file} download>Download prepared {fps} FPS render ↓</a>}
    </div>
    <p>For a fresh export, run this in the dashboard project. Use a new filename for each render.</p>
    <code>{command}</code><button onClick={()=>navigator.clipboard.writeText(command).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?"Copied":"Copy command"}</button>
    <p>Requires FFmpeg and Playwright Chromium. Prepared downloads show this saved composition.</p>
  </details>
}
