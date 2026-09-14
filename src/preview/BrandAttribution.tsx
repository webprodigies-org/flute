import { FLUTE_BRAND } from '../core';

/** SOURCE OF TRUTH: BrandAttribution.
 * WHAT: accessible creator attribution for studio chrome.
 * WHY: every visible creator name links to the canonical FLUTE_BRAND destination.
 * WHERE: SceneLibrary, GettingStarted and ScenePreview; never inside scene capture.
 */
export function BrandAttribution({showName = true}: {showName?: boolean}) {
  return <span className="flute-attribution">{showName && <>{FLUTE_BRAND.name} </>}by <a href={FLUTE_BRAND.url} target="_blank" rel="noopener noreferrer" aria-label={FLUTE_BRAND.creator + ' on YouTube (opens in a new tab)'}>{FLUTE_BRAND.creator}</a></span>;
}
