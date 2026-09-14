/** SOURCE OF TRUTH: studioTheme.
 * WHAT: shared attribution and getting-started chrome styles.
 * WHY: installed library and standalone preview keep the same accessible handoff.
 * WHERE: libraryTheme and previewTheme include this scoped stylesheet.
 */
export const studioTheme = `
.flute-attribution{color:#aaa;font-size:11px;line-height:1.6;white-space:nowrap}
.flute-attribution a{color:inherit!important;text-decoration:underline!important;text-underline-offset:3px}
.flute-attribution a:hover{color:#fff!important}
.flute-attribution a:focus-visible,.flute-onboarding summary:focus-visible,.flute-onboarding button:focus-visible{outline:2px solid #fff;outline-offset:4px}
.flute-onboarding{flex-shrink:0;width:100%;max-width:500px}
.flute-onboarding summary{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:44px;border:1px solid #ffffff30;border-radius:999px;background:#efeff2;color:#17171a;padding:11px 22px;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer;list-style:none}
.flute-onboarding summary::-webkit-details-marker{display:none}
.flute-onboarding-content{margin-top:16px;padding:20px;text-align:left;background:#19191c;border:1px solid #ffffff20;border-radius:20px;font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.flute-onboarding-content ol{padding-left:20px;margin:0 0 18px;color:#c5c5cc}
.flute-onboarding-content li+li{margin-top:12px}
.flute-onboarding-content code{font-size:12px;color:#eee}
.flute-onboarding-content p{padding:0;background:none;margin:12px 0;line-height:1.6;font-size:13px;max-width:none}
.flute-onboarding-content .flute-prompt-label{color:#f5f5f7;font-weight:600;margin-bottom:8px}
.flute-onboarding-content .flute-prompt{padding:14px;background:#101012;color:#c5c5cc;border-radius:12px;user-select:text}
.flute-onboarding-content button{min-height:44px;padding:10px 18px;border:1px solid #ffffff30;border-radius:999px;background:#29292d;color:#fff;font:inherit;cursor:pointer}
.flute-onboarding-content button:disabled{opacity:.6;cursor:default}
.flute-onboarding-content .flute-copy-status{color:#aaa;font-size:12px}
`;
