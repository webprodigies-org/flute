import {studioTheme} from './studio-theme';
/** SOURCE OF TRUTH: previewTheme, flute-bottom-blur, flute-controls.
 * WHAT: edge-to-edge scene surface and one scrollable bottom controls overlay.
 * WHY: three static, masked backdrop layers reveal the actual scene without a reserved dock.
 * WHERE: ScenePreview owns markup; scene/capture geometry and host UI remain independent.
 * Blur is capped at 320px/half the viewport, never animated, and ignores pointer events.
 */
export const previewTheme = `
${studioTheme}
[data-flute-preview]{position:fixed;inset:0;height:100dvh;overflow:hidden;background:#000;color:#fff;min-height:0;width:100%;box-sizing:border-box;isolation:isolate}
.flute-chrome{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;color:#fff}
.flute-viewport{position:absolute;inset:0;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center}
.flute-canvas{flex:none;position:relative;overflow:hidden;background:#000}
.flute-bottom-blur{position:absolute;inset:auto 0 0;height:min(320px,50%);pointer-events:none;z-index:1}
.flute-bottom-blur i{position:absolute;inset:0;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);mask-image:linear-gradient(transparent,#000 55%);-webkit-mask-image:linear-gradient(transparent,#000 55%)}
.flute-bottom-blur i:first-child{background:rgb(0 0 0 / .28)}
.flute-bottom-blur i:nth-child(2){top:25%;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);mask-image:linear-gradient(transparent,#000 65%);-webkit-mask-image:linear-gradient(transparent,#000 65%)}
.flute-bottom-blur i:nth-child(3){top:50%;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);mask-image:linear-gradient(transparent,#000 80%);-webkit-mask-image:linear-gradient(transparent,#000 80%)}
.flute-footer{position:absolute;inset:auto 0 0;z-index:2;pointer-events:none;padding:24px max(24px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));box-sizing:border-box}
.flute-controls{max-width:760px;max-height:calc(100dvh - 48px - env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;margin:0 auto;display:flex;flex-direction:column;gap:12px;pointer-events:auto;padding:6px;scrollbar-width:thin;scrollbar-color:#666 transparent}
.flute-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0}
.flute-heading{display:flex;align-items:center;gap:16px;min-width:0}
.flute-title{font-size:15px;font-weight:600;letter-spacing:-.2px;color:#fff;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.flute-control{appearance:none;box-sizing:border-box;border:1px solid #ffffff30;border-radius:999px;padding:11px 18px;background:#242424;color:#fff;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap;min-height:44px;flex-shrink:0;transition:background .15s;box-shadow:none}
.flute-control:hover{background:#3a3a3a}.flute-control:disabled{opacity:.45;cursor:default}
.flute-control:focus-visible,.flute-timeline:focus-visible,.flute-export-panel select:focus-visible,[data-flute-error] button:focus-visible{outline:2px solid #fff;outline-offset:3px}
.flute-primary{background:#fff;color:#111;border-color:transparent}.flute-primary:hover{background:#e5e5e5}
.flute-icon{width:44px;padding:12px}.flute-control svg{width:17px;height:17px;flex:none}
.flute-dock{display:flex;align-items:center;gap:12px;width:100%;flex-shrink:0}
.flute-timeline{appearance:none;min-width:30px;flex:1;height:44px;margin:0;border-radius:999px;accent-color:#fff;cursor:pointer;background:transparent}
.flute-timeline::-webkit-slider-runnable-track{height:4px;background:#858585;border-radius:999px}
.flute-timeline::-webkit-slider-thumb{appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:100%;background:#fff}
.flute-timeline::-moz-range-track{height:4px;background:#858585;border-radius:999px}
.flute-timeline::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:100%;background:#fff}
.flute-timeline:disabled{opacity:.45;cursor:default}
.flute-time{font-size:12px;font-variant-numeric:tabular-nums;color:#fff;white-space:nowrap;min-width:88px}
.flute-preview-meta{display:flex;align-items:center;justify-content:center;gap:6px 18px;flex-wrap:wrap;flex-shrink:0}
.flute-status{font-size:12px;color:#e5e5e5;display:flex;gap:7px;align-items:center;justify-content:center;min-height:20px;flex-shrink:0}
.flute-status-dot{width:5px;height:5px;background:currentColor;border-radius:50%}
.flute-message,[data-flute-preview] [data-flute-error]{background:#202020;border:1px solid #ffffff30;border-radius:20px;padding:16px 20px;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;margin:0;max-height:25dvh;overflow:auto;overflow-wrap:anywhere;flex-shrink:0}
.flute-message p,[data-flute-error] p{margin:6px 0}.flute-message ul{padding-left:20px;margin:8px 0}
[data-flute-preview] [data-flute-error] button{border:0;border-radius:999px;padding:12px 20px;min-height:44px;background:#fff;color:#111;font:inherit;cursor:pointer}
.flute-empty{max-width:410px;text-align:center;padding:24px;margin:auto;align-self:center}
.flute-empty h1{font-size:38px;line-height:1.15;font-weight:500;letter-spacing:-1.8px;margin:24px 0 16px}
.flute-empty p{color:#aaa;line-height:1.8;margin:0;font-size:14px}
.flute-empty-symbol{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:26px;background:#202020;color:#fff;font-size:30px}
.flute-onboarding{flex-shrink:0}.flute-onboarding summary,.flute-export summary{list-style:none}.flute-onboarding summary::-webkit-details-marker,.flute-export summary::-webkit-details-marker{display:none}
.flute-export-slot:empty{display:none}
.flute-export-panel{margin-left:auto;width:min(350px,100%);box-sizing:border-box;padding:22px;background:#202020;border:1px solid #ffffff30;border-radius:24px;white-space:normal;overflow-wrap:anywhere}
.flute-export-panel p{color:#d4d4d4;line-height:1.6;margin:8px 0 16px}.flute-export-panel select{border:1px solid #ffffff40;background:#333;color:#fff;padding:9px 14px;border-radius:999px;font:inherit;margin-left:12px;min-height:44px;max-width:100%}
.flute-export-panel code{display:block;background:#111;color:#eee;font-size:11px;padding:14px;border-radius:14px;overflow-wrap:anywhere;white-space:pre-wrap;margin:16px 0}
[data-flute-preview] [data-flute-diagnostics]{display:none}
@media(max-width:700px){.flute-footer{padding:12px max(10px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))}.flute-controls{gap:10px;max-height:calc(100dvh - 24px - env(safe-area-inset-bottom))}.flute-header{gap:8px}.flute-heading{flex-wrap:wrap;gap:8px}.flute-title{flex-basis:100%;font-size:13px}.flute-control{padding:10px 14px}.flute-icon{padding:12px}.flute-dock{gap:8px}.flute-time{min-width:76px;font-size:11px}.flute-empty h1{font-size:30px}}
@media(max-height:500px){.flute-footer{padding-top:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}.flute-controls{gap:8px;max-height:calc(100dvh - 16px - env(safe-area-inset-bottom))}.flute-empty-symbol{display:none}.flute-empty h1{font-size:24px;margin:0 0 8px}}
@media(prefers-reduced-motion:reduce){.flute-control{transition:none}}
`;
