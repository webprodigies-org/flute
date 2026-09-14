/** SOURCE OF TRUTH: previewTheme.
 * WHAT: scoped product chrome with rounded shapes, subtle gradients and ample space.
 * WHY: installed previews share one visual language without styling their host content.
 * WHERE: ScenePreview injects these rules; selectors never target live application UI.
 */
export const previewTheme = `
[data-flute-preview]{position:fixed;inset:0;height:100svh;overflow:auto;background:#09090c;color:#f3f2f7;min-height:0;width:100%;box-sizing:border-box;padding:28px 36px 24px;display:flex;flex-direction:column;gap:24px;isolation:isolate}
.flute-chrome{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;box-sizing:border-box;color:#f3f2f7}
.flute-header{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:52px}
.flute-brand{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:650;letter-spacing:-1px}
.flute-mark{width:32px;height:32px;background:linear-gradient(140deg,#e6dfff,#afa7e4 50%,#6786ae);border-radius:11px 18px 11px 18px;box-shadow:inset 0 1px 2px #ffffff80;transform:rotate(-12deg)}
.flute-title{font-size:14px;font-weight:450;color:#a8a5b5;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.flute-actions{display:flex;align-items:center;gap:10px}
.flute-control{appearance:none;box-sizing:border-box;border:0;border-radius:999px;padding:12px 20px;background:#202026;color:#eeedf3;font:500 13px/1.4 ui-sans-serif,system-ui,sans-serif;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap;min-height:44px;transition:background .15s}
.flute-control:hover{background:#303038}.flute-control:disabled{opacity:.35;cursor:default}
.flute-control:focus-visible,.flute-timeline:focus-visible,.flute-export summary:focus-visible{outline:2px solid #c2afff;outline-offset:4px}
.flute-primary{background:linear-gradient(120deg,#f0e9ff,#c9d4f3);color:#222030}.flute-primary:hover{background:#f1edff}
.flute-icon{width:44px;padding:12px}.flute-control svg{width:17px;height:17px;flex:none}
.flute-viewport{position:relative;background:#000;border-radius:32px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:380px;height:calc(100svh - 236px);flex:1}
.flute-canvas{flex:none;position:relative;overflow:hidden;background:#000}
.flute-empty{max-width:410px;text-align:center;padding:64px 24px;margin:auto}
.flute-empty h1{font-size:38px;line-height:1.15;font-weight:500;letter-spacing:-1.8px;margin:24px 0 16px}
.flute-empty p{color:#9693a4;line-height:1.8;margin:0 0 28px;font-size:14px}
.flute-empty-symbol{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:26px;background:linear-gradient(145deg,#34303e,#17171e);box-shadow:inset 0 1px 0 #ffffff15;color:#d6c8f7;font-size:30px}
.flute-footer{display:flex;align-items:center;justify-content:center;gap:20px;position:relative;min-height:64px}
.flute-dock{display:flex;align-items:center;gap:14px;background:linear-gradient(120deg,#24232c,#1b1c23);border-radius:999px;padding:10px 14px;max-width:720px;width:100%;box-shadow:inset 0 1px 0 #ffffff09}
.flute-timeline{appearance:none;min-width:50px;flex:1;height:4px;border-radius:999px;accent-color:#ded3ff;cursor:pointer;background:#4a4656}
.flute-timeline::-webkit-slider-thumb{appearance:none;width:12px;height:12px;border-radius:100%;background:#e7dfff}
.flute-time{font-size:12px;font-variant-numeric:tabular-nums;color:#c2bece;white-space:nowrap;min-width:88px}
.flute-status{font-size:12px;color:#a8a3b5;display:flex;gap:7px;align-items:center;min-height:20px}
.flute-status-dot{width:5px;height:5px;background:#b9abda;border-radius:50%}
.flute-message{background:#25202d;border-radius:20px;padding:20px 24px;font-size:13px;line-height:1.7;color:#e3d9ed;margin:0}.flute-message p{margin:4px 0}.flute-message ul{padding-left:20px;margin:8px 0}
[data-flute-preview] [data-flute-error]{font:14px/1.7 system-ui;padding:40px;border-radius:24px;color:#eee;background:#241f2b;max-width:600px;margin:40px auto;pointer-events:auto}[data-flute-preview] [data-flute-error] button{border:0;border-radius:999px;padding:12px 20px;background:#e4d8ff;color:#242030;cursor:pointer}.flute-onboarding summary{list-style:none}.flute-onboarding summary::-webkit-details-marker{display:none}.flute-onboarding p{margin-top:20px}
.flute-export{position:relative}.flute-export summary{list-style:none}.flute-export summary::-webkit-details-marker{display:none}
.flute-export-panel{position:absolute;right:0;top:56px;z-index:10;width:min(350px,calc(100vw - 48px));padding:24px;background:#23222c;border-radius:24px;box-shadow:0 24px 80px #000a;white-space:normal}
.flute-export-panel p{color:#b9b3c8;line-height:1.7;margin:8px 0 16px}.flute-export-panel select{border:0;background:#37323f;color:#fff;padding:9px 14px;border-radius:999px;font:inherit;margin-left:12px}
.flute-export-panel code{display:block;background:#151319;color:#dad1e9;font-size:11px;padding:14px;border-radius:14px;overflow-wrap:anywhere;white-space:pre-wrap;margin:16px 0}
[data-flute-preview] [data-flute-diagnostics]{display:none}
@media(max-width:700px){[data-flute-preview]{padding:20px 16px;gap:18px}.flute-header{flex-wrap:wrap;gap:14px}.flute-title{order:3;flex-basis:100%;font-size:13px}.flute-brand{font-size:20px}.flute-actions{margin-left:auto;gap:6px}.flute-actions .flute-control{padding:10px 14px}.flute-viewport{border-radius:24px;height:calc(100svh - 254px);min-height:320px}.flute-dock{gap:8px;padding:8px}.flute-time{min-width:76px;font-size:11px}.flute-empty h1{font-size:30px}.flute-footer{gap:8px;flex-wrap:wrap}.flute-status{flex-basis:100%;justify-content:center}}
@media(prefers-reduced-motion:reduce){.flute-control{transition:none}}
`;
