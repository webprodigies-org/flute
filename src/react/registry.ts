import type { Measurement, TransformInput } from '../core';

/** SOURCE OF TRUTH: React registration and untransformed layout measurements.
 * WHAT: one ephemeral registry per Scene; entries use mount identity, not public IDs.
 * WHY: duplicate IDs must reach core validation, and StrictMode cleanup must remove
 * only its own binding. No component instances or host data enter scene metadata.
 * WHERE: index.tsx supplies bindings; core owns all spatial policy and evaluation.
 */
export type Binding = { token: symbol; id: string; parent?: symbol; element: HTMLDivElement; transform?: TransformInput };
function sameObject(a: object | undefined, b: object | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(Reflect.get(a, key), Reflect.get(b, key)));
}

// offset geometry excludes CSS transforms. Both origins use the same offset chain;
// ancestor borders and scroll are accounted for before converting to local centers.
function origin(element: HTMLElement) {
  let x = 0, y = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    x += parent?.clientLeft ?? 0;
    y += parent?.clientTop ?? 0;
  }
  for (let node = element.parentElement; node; node = node.parentElement) {
    x -= node.scrollLeft;
    y -= node.scrollTop;
  }
  return { x, y };
}

export function createRegistry() {
  const entries = new Map<symbol, Binding>();
  const measurements = new Map<symbol, Measurement>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let stage: HTMLDivElement | null = null;
  let observer: ResizeObserver | undefined;
  const publish = () => { revision++; listeners.forEach(listener => listener()); };
  const measure = () => {
    if (!stage) return false;
    let changed = false;
    for (const [token, entry] of entries) {
      const parent = (entry.parent && entries.get(entry.parent)?.element) || stage;
      const p = origin(parent), e = origin(entry.element);
      const width = entry.element.offsetWidth, height = entry.element.offsetHeight;
      const next = { width, height, offsetX: e.x + width / 2 - p.x - parent.offsetWidth / 2, offsetY: e.y + height / 2 - p.y - parent.offsetHeight / 2 };
      if (!sameObject(measurements.get(token), next)) { measurements.set(token, next); changed = true; }
    }
    return changed;
  };
  const refresh = () => { if (measure()) publish(); };
  return {
    entries, measurements,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => revision,
    refresh,
    mount(element: HTMLDivElement) {
      stage = element;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(refresh);
        observer.observe(element);
        entries.forEach(entry => observer!.observe(entry.element));
      }
      window.addEventListener('resize', refresh);
      element.addEventListener('scroll', refresh, true);
      refresh();
      return () => {
        observer?.disconnect(); observer = undefined;
        window.removeEventListener('resize', refresh);
        element.removeEventListener('scroll', refresh, true);
        stage = null;
      };
    },
    upsert(binding: Binding) {
      const previous = entries.get(binding.token);
      const changed = !previous || previous.id !== binding.id || previous.parent !== binding.parent || previous.element !== binding.element || !sameObject(previous.transform, binding.transform);
      if (changed) {
        if (previous && previous.element !== binding.element) observer?.unobserve(previous.element);
        entries.set(binding.token, { ...binding, transform: binding.transform && { ...binding.transform } });
        observer?.observe(binding.element);
      }
      if (measure() || changed) publish();
    },
    remove(token: symbol) {
      const previous = entries.get(token);
      if (!previous) return;
      observer?.unobserve(previous.element);
      entries.delete(token); measurements.delete(token);
      measure(); publish();
    },
  };
}
export type Registry = ReturnType<typeof createRegistry>;
