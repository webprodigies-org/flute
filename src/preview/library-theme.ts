import {studioTheme} from './studio-theme';
/** SOURCE OF TRUTH: libraryTheme. WHAT: catalog layout only. WHY: no host CSS leakage.
 * WHERE: SceneLibrary supplies actual recipes; canonical Scene handles perspective/focus.
 */
export const libraryTheme=`
${studioTheme}
[data-flute-library]{position:fixed;inset:0;background:#000;color:#f5f5f7;font:14px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;isolation:isolate}
[data-flute-library] a{color:inherit;text-decoration:none}
.flute-library-top{position:absolute;z-index:5;top:28px;left:36px;right:36px;display:flex;justify-content:space-between;pointer-events:none}.flute-library-top a{pointer-events:auto}.flute-library-brand{font-size:23px;font-weight:600;letter-spacing:-1px}
.flute-library-identity{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.flute-library-brand:focus-visible{outline:2px solid #fff;outline-offset:4px}
.flute-library-scroll{height:100svh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#333 #000;outline-offset:-4px}
/* Mask the final composited viewport, outside Scene's preserve-3d hierarchy. */
.flute-library-stage{position:sticky;top:0;height:100svh;overflow:hidden;mask-image:linear-gradient(to bottom,transparent,#000 min(180px,20svh));-webkit-mask-image:linear-gradient(to bottom,transparent,#000 min(180px,20svh))}
.flute-library-heading,.flute-scene-row{box-sizing:border-box;background:#19191c}.flute-library-heading{height:110px;border-radius:28px 28px 0 0;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;gap:20px}.flute-library-heading h1{font-size:27px;margin:0;letter-spacing:-.8px;font-weight:550}.flute-library-heading>span{color:#929297}
.flute-scene-row{display:flex;align-items:center;gap:26px;height:150px;padding:28px 36px;border-top:1px solid #262628;outline-offset:-5px}.flute-scene-row:hover{background:#232326}.flute-scene-row:focus-visible{outline:3px solid #ddd;background:#29292c}
.flute-scene-number{position:relative;flex:none;width:76px;height:76px;overflow:hidden;display:grid;place-items:center;border-radius:18px;background:#29292d;color:#dadade;font-size:27px;font-weight:350;font-variant-numeric:tabular-nums}
.flute-scene-number img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.flute-scene-copy{min-width:0;display:flex;flex-direction:column;gap:7px}.flute-scene-copy strong{font-size:27px;line-height:1.2;font-weight:500;letter-spacing:-.7px}.flute-scene-copy>span{color:#99999f;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.flute-scene-duration{margin-left:auto;flex:none;font-size:17px;color:#a3a3a8;font-variant-numeric:tabular-nums}.flute-scene-duration>span{margin-left:20px;color:#ececf0}
.flute-library-hint{position:absolute;bottom:22px;left:0;right:0;text-align:center;font-size:12px;color:#999;pointer-events:none}
.flute-library-empty{position:absolute;inset:90px 0 24px;overflow:auto;display:flex;padding:20px;box-sizing:border-box}.flute-library-empty>div{width:100%;margin:auto;display:flex;flex:none;flex-direction:column;align-items:center;text-align:center;gap:14px}.flute-library-empty>div>span{font-size:11px;letter-spacing:2px;color:#aaa}.flute-library-empty h1{max-width:580px;font-size:clamp(32px,5vw,56px);font-weight:450;line-height:1.08;letter-spacing:-2px;margin:8px 0}.flute-library-empty>div>p{max-width:450px;color:#aaa;margin:0 0 10px}
.flute-library-notice,.flute-library-issues{position:absolute;z-index:6;top:75px;left:5%;right:5%;padding:12px 20px;background:#252529;border-radius:16px;max-height:25vh;overflow:auto}.flute-library-issues{top:auto;bottom:55px}.flute-library-issues summary{cursor:pointer}.flute-library-notice a{text-decoration:underline}
@media(max-width:600px){.flute-library-top{top:20px;left:24px;right:24px}.flute-library-heading{padding:20px;gap:12px}.flute-library-heading h1{font-size:24px}.flute-library-heading>span{font-size:11px}.flute-scene-row{padding:20px;gap:14px}.flute-scene-number{width:56px;height:56px;border-radius:12px;font-size:20px}.flute-scene-copy strong{font-size:20px}.flute-scene-copy>span{font-size:12px;max-width:160px}.flute-scene-duration{font-size:12px}.flute-scene-duration>span{display:none}}
`;
