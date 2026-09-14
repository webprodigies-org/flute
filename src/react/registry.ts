import type { Measurement, TransformInput, SceneIssue } from "../core";

/** SOURCE OF TRUTH: React registration and untransformed layout measurements.
 * WHAT: one ephemeral registry per Scene; entries use mount identity, not public IDs.
 * WHY: duplicate IDs must reach core validation, and StrictMode cleanup must remove
 * only its own binding. No component instances or host data enter scene metadata.
 * WHERE: index.tsx supplies bindings; core owns all spatial policy and evaluation.
 */
export type Binding = {
  token: symbol;
  id: string;
  parent?: symbol;
  element: HTMLDivElement;
  transform?: TransformInput;
};
function sameObject(a: object | undefined, b: object | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(Reflect.get(a, key), Reflect.get(b, key)))
  );
}

// offset geometry excludes CSS transforms. Both origins use the same offset chain;
// ancestor borders and scroll are accounted for before converting to local centers.
function origin(element: HTMLElement) {
  let x = 0,
    y = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
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


// SOURCE OF TRUTH: unfiltered group content diagnostics. Spatial ancestors cannot
// be filtered without flattening descendants. Check actual rendered host content,
// including custom React components; never silently leave labels/media sharp.
function uncoveredContent(root:Element):boolean {
  for (const child of root.childNodes) {
    if (child.nodeType===3 && child.textContent?.trim()) return true;
    if (!(child instanceof Element)) continue;
    if (child.hasAttribute("data-flute-id") || child.hasAttribute("data-flute-content") || child.matches('svg[width="0"],script,style,template')) continue;
    const css=getComputedStyle(child);
    if(css.display==='none'||css.visibility==='hidden') continue;
    if(child.matches('img,svg,canvas,video,input,textarea,select') || (css.backgroundImage && css.backgroundImage!=='none')) return true;
    if(uncoveredContent(child)) return true;
  }
  return false;
}

export function createRegistry() {
  const entries = new Map<symbol, Binding>();
  const measurements = new Map<symbol, Measurement>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let coverageDirty=true;
  let coverageIssues:SceneIssue[]=[];
  let mutations:MutationObserver|undefined;
  let stage: HTMLDivElement | null = null;
  let observer: ResizeObserver | undefined;
  const publish = () => {
    revision++;
    listeners.forEach((listener) => listener());
  };
  const measure = () => {
    if (!stage) return false;
    let changed = false;
    for (const [token, entry] of entries) {
      const parent =
        (entry.parent && entries.get(entry.parent)?.element) || stage;
      const p = origin(parent),
        e = origin(entry.element);
      const width = entry.element.offsetWidth,
        height = entry.element.offsetHeight;
      const next = {
        width,
        height,
        offsetX: e.x + width / 2 - p.x - parent.offsetWidth / 2,
        offsetY: e.y + height / 2 - p.y - parent.offsetHeight / 2,
      };
      if (!sameObject(measurements.get(token), next)) {
        measurements.set(token, next);
        changed = true;
      }
    }
    if(coverageDirty) {
      coverageDirty=false;
      const groups=new Set(Array.from(entries.values()).map(b=>b.parent));
      const next=Array.from(entries.values()).filter(b=>groups.has(b.token)&&uncoveredContent(b.element)).map(b=>({path:b.id,message:"Unfiltered content in spatial group. Wrap each visible text/media region in a Surface, or put its paint in content. Group filters would flatten nested 3D."}));
      if(uncoveredContent(stage)) next.push({path:"scene",message:"Unfiltered scene content. Wrap visible text/media in a Surface so camera depth of field can apply."});
      if(JSON.stringify(next)!==JSON.stringify(coverageIssues)){coverageIssues=next;changed=true;}
    }
    return changed;
  };
  const refresh = () => {
    if (measure()) publish();
  };
  return {
    entries,
    measurements,
    get coverageIssues(){return coverageIssues;},
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => revision,
    refresh,
    mount(element: HTMLDivElement) {
      stage = element;
      if(typeof MutationObserver!=="undefined") {
        mutations=new MutationObserver(records=>{
          if(records.some(r=>!(r.target instanceof Element ? r.target : r.target.parentElement)?.closest('[data-flute-content],svg[width="0"]'))) {
            coverageDirty=true; refresh();
          }
        });
        mutations.observe(element,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["data-flute-content"]});
      }
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(refresh);
        observer.observe(element);
        entries.forEach((entry) => observer!.observe(entry.element));
      }
      window.addEventListener("resize", refresh);
      element.addEventListener("scroll", refresh, true);
      refresh();
      return () => {
        mutations?.disconnect();
        observer?.disconnect();
        observer = undefined;
        window.removeEventListener("resize", refresh);
        element.removeEventListener("scroll", refresh, true);
        stage = null;
      };
    },
    upsert(binding: Binding) {
      const previous = entries.get(binding.token);
      const changed =
        !previous ||
        previous.id !== binding.id ||
        previous.parent !== binding.parent ||
        previous.element !== binding.element ||
        !sameObject(previous.transform, binding.transform);
      if (changed) {
        if (previous && previous.element !== binding.element)
          observer?.unobserve(previous.element);
        entries.set(binding.token, {
          ...binding,
          transform: binding.transform && { ...binding.transform },
        });
        observer?.observe(binding.element);
      }
      // Playback re-renders every binding. Unchanged registration must not perform
      // N full layout walks; Scene refreshes once after the commit, while resize
      // and scroll observers handle external geometry changes.
      if (changed) {
        coverageDirty=true;
        measure();
        publish();
      }
    },
    remove(token: symbol) {
      const previous = entries.get(token);
      if (!previous) return;
      observer?.unobserve(previous.element);
      entries.delete(token);
      coverageDirty=true;
      measurements.delete(token);
      measure();
      publish();
    },
  };
}
export type Registry = ReturnType<typeof createRegistry>;
