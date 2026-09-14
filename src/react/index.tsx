import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  RESOURCES,
  SCENE_BACKGROUND,
  cameraToCss,
  transformToCss,
  uniformFocusBlur,
  motionTime,
  type CameraInput,
  type EvaluatedNode,
  type FocusInput,
  type Measurements,
  type SceneIssue,
  type TransformInput,
} from "../core";
import { type MotionInput } from "../core/motion";
import { FocusFilter } from "./FocusFilter";
import { createRegistry, type Registry } from "./registry";

/** SOURCE OF TRUTH: Scene / Surface / Motion live DOM adapter.
 * WHAT: bind existing React subtrees to the canonical core spatial operation.
 * WHY: providers, events and state stay in their original React tree during focus
 * and transform edits. Core alone validates configuration and computes focal depth.
 * WHERE: registry.ts owns DOM layout; ../core owns schema and transform order.
 * Composition: content is an isolated visual leaf; children may contain spatial
 * groups. Without content, ordinary children blur until a nested node registers.
 * Spatial containers ignore pointer hits; live visual leaves receive events.
 * A grouping wrapper never filters descendants. Put group backgrounds in content.
 * Host intermediary filters, opacity, paint containment, clipping/overflow and CSS
 * transforms can flatten or change 3D geometry: use Surface/Motion for transforms,
 * and put clipping, opacity and decoration on content leaves. Layout styles belong
 * on wrappers. Arbitrary host layout shifts require resize or a React commit.
 */
type SceneContextValue = {
  registry: Registry;
  nodes: Map<string, EvaluatedNode>;
  transforms: Map<string, TransformInput>;
  opacities: Map<string, number>;
  timeMs: number;
};
const SceneContext = createContext<SceneContextValue | null>(null);
const ParentContext = createContext<symbol | undefined>(undefined);
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
export type SceneProps = {
  motion?: MotionInput;
  timeMs?: number;
  children?: ReactNode;
  camera?: CameraInput;
  focus?: FocusInput;
  className?: string;
  style?: CSSProperties;
  onDiagnostics?: (issues: SceneIssue[]) => void;
};
export type SurfaceProps = {
  id: string;
  transform?: TransformInput;
  children?: ReactNode;
  content?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Scene({
  children,
  camera,
  focus,
  motion,
  timeMs = 0,
  className,
  style,
  onDiagnostics,
}: SceneProps) {
  const [registry] = useState(createRegistry);
  const revision = useSyncExternalStore(
    registry.subscribe,
    registry.snapshot,
    registry.snapshot,
  );
  const stage = useRef<HTMLDivElement>(null);
  useLayout(() => registry.mount(stage.current!), [registry]);
  useLayout(() => {
    registry.refresh();
  });
  const result = useMemo(() => {
    const bindings = Array.from(registry.entries.values());
    const state = motion
      ? RESOURCES["evaluate-motion"](motion, timeMs)
      : { surfaces: {}, camera: {}, focus: {}, issues: [] };
    const input = {
      camera: { ...camera, ...state.camera },
      focus: { ...focus, ...state.focus },
      nodes: bindings.map((binding) => ({
        id: binding.id,
        parentId: binding.parent
          ? registry.entries.get(binding.parent)?.id
          : undefined,
        transform: {
          ...binding.transform,
          ...Object.fromEntries(
            Object.entries(state.surfaces[binding.id] ?? {}).filter(
              ([key]) => key !== "opacity",
            ),
          ),
        },
      })),
    };
    const validated = RESOURCES["validate-definition"](input);
    const measurements: Measurements = Object.fromEntries(
      bindings.flatMap((binding) => {
        const measurement = registry.measurements.get(binding.token);
        return measurement ? [[binding.id, measurement] as const] : [];
      }),
    );
    const evaluation = RESOURCES["evaluate-spatial"](input, measurements);
    const ids = new Set(bindings.map((b) => b.id));
    evaluation.issues.push(
      ...state.issues,
      ...(validated.success && validated.data.focus.maxBlur>0 ? registry.coverageIssues : []),
      ...Object.keys(state.surfaces)
        .filter((id) => !ids.has(id))
        .map((id) => ({
          path: "motion." + id,
          message: "Motion target is not registered: " + id,
        })),
    );
    if (!Number.isFinite(timeMs))
      evaluation.issues.push({
        path: "timeMs",
        message: "Scene time must be finite.",
      });
    return { evaluation, validated, state };
  }, [registry, revision, camera, focus, motion, timeMs]);
  const context = useMemo(
    () => ({
      registry,
      timeMs: motion ? motionTime(motion, timeMs) : Number.isFinite(timeMs) ? timeMs : 0,
      opacities: new Map(
        Object.entries(result.state.surfaces).map(([id, s]) => [
          id,
          s.opacity ?? 1,
        ]),
      ),
      nodes: new Map(result.evaluation.nodes.map((node) => [node.id, node])),
      transforms: new Map(
        result.validated.success
          ? result.validated.data.nodes.map((node) => [node.id, node.transform])
          : [],
      ),
    }),
    [registry, result, timeMs, motion],
  );
  // Callback identity can change when the host stores diagnostics in state. Only
  // issue changes notify it, including a single empty report after correction.
  const callback = useRef(onDiagnostics);
  callback.current = onDiagnostics;
  const issueKey = JSON.stringify(result.evaluation.issues);
  const lastReported = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastReported.current !== issueKey) {
      lastReported.current = issueKey;
      callback.current?.(JSON.parse(issueKey) as SceneIssue[]);
    }
  }, [issueKey]);
  const validCamera = result.validated.success
    ? result.validated.data.camera
    : undefined;
  return (
    <SceneContext.Provider value={context}>
      <ParentContext.Provider value={undefined}>
        <div
          className={className}
          data-flute-scene=""
          data-flute-valid={result.evaluation.issues.length===0 ? "true" : "false"}
          style={{
            ...style,
            background: SCENE_BACKGROUND,
            backgroundColor: SCENE_BACKGROUND,
            backgroundImage: "none",
            position: style?.position ?? "relative",
            pointerEvents: "none",
            perspective: validCamera?.perspective ?? 1400,
            perspectiveOrigin: "50% 50%",
            // Keep the backdrop outside the 3D sorting context so negative-z UI stays visible.
            // The inner camera stage preserves depth among all surfaces.
            transformStyle: "flat",
          }}
        >
          <div
            ref={stage}
            data-flute-stage=""
            style={{
              position: "relative",
              pointerEvents: "none",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transformOrigin: "50% 50%",
              transform: cameraToCss(validCamera),
            }}
          >
            {children}
          </div>
        </div>
        {result.evaluation.issues.length > 0 && (
          <div role="alert" data-flute-diagnostics="">
            <strong>Flute scene needs a correction.</strong>
            <ul>
              {result.evaluation.issues.map((issue, index) => (
                <li key={index}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
            <p>
              Correct the scene props or registered IDs; the scene updates
              automatically.
            </p>
          </div>
        )}
      </ParentContext.Provider>
    </SceneContext.Provider>
  );
}

export function Surface({
  id,
  transform,
  children,
  content,
  className,
  style,
}: SurfaceProps) {
  const filterId = "flute-focus-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const context = useContext(SceneContext);
  const parent = useContext(ParentContext);
  const [token] = useState(() => Symbol("flute-binding"));
  const element = useRef<HTMLDivElement>(null);
  if (!context)
    throw new Error(
      "Surface and Motion must be rendered inside a Flute Scene.",
    );
  const { registry, nodes, transforms } = context;
  useLayout(() => {
    registry.upsert({
      token,
      id,
      parent,
      element: element.current!,
      transform,
    });
  });
  useLayout(() => () => registry.remove(token), [registry, token]);
  const node = nodes.get(id);
  const grouped = Array.from(registry.entries.values()).some(
    (binding) => binding.parent === token,
  );
  const blur = node?.blur ?? 0;
  const filtering =
    node &&
    node.width > 0 &&
    node.height > 0 &&
    node.focus.maxBlur > 0 &&
    (content !== undefined || !grouped);
  const uniformBlur = filtering ? uniformFocusBlur(node.focus, node.width, node.height) : 0;
  const leafStyle: CSSProperties = {
    pointerEvents: style?.pointerEvents ?? "auto",
    opacity: context.opacities.get(id) ?? 1,
    filter: !filtering || uniformBlur === 0 ? "none"
      : uniformBlur !== undefined ? `blur(${uniformBlur}px)` : `url(#${filterId})`,
  };
  return (
    <ParentContext.Provider value={token}>
      {filtering && uniformBlur === undefined && <FocusFilter id={filterId} node={node} />}
      <div
        ref={element}
        className={className}
        data-flute-id={id}
        data-flute-blur={blur}
        data-flute-depth={node?.worldPosition.z ?? 0}
        style={{
          ...style,
          position: style?.position ?? "relative",
          transform: transformToCss(transforms.get(id)),
          transformOrigin: "50% 50%",
          transformStyle: "preserve-3d",
          filter: "none",
          opacity: 1,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {content !== undefined && (
          <div data-flute-content="" style={leafStyle}>
            {content}
          </div>
        )}
        <div
          data-flute-content={
            content === undefined && !grouped ? "" : undefined
          }
          style={{
            transformStyle: "preserve-3d",
            ...(content === undefined && !grouped
              ? leafStyle
              : { filter: "none", pointerEvents: "none" }),
          }}
        >
          {children}
        </div>
      </div>
    </ParentContext.Provider>
  );
}

/** Opt-in component adapters read the same explicit time used by spatial tracks. */
export function useSceneTime(): number {
  const context = useContext(SceneContext);
  if (!context) throw new Error("useSceneTime requires a Flute Scene.");
  return context.timeMs;
}
/** Motion shares Surface registration; Scene supplies canonical evaluated tracks. */
export const Motion = Surface;

export type SceneErrorBoundaryProps = {
  children?: ReactNode;
  resetKey?: unknown;
  onError?: (error: unknown) => void;
  onReset?: () => void;
};
/** SOURCE OF TRUTH: scene render recovery.
 * WHAT: SceneErrorBoundary owns the scene fallback and resetKey adapter.
 * WHY: preserve a consistent recovery action for failed host components.
 * WHERE: react-error-boundary catches render failures; callers keep their existing API.
 */
export function SceneErrorBoundary({ children, resetKey, onError, onReset }: SceneErrorBoundaryProps) {
  return (
    <ErrorBoundary FallbackComponent={SceneErrorFallback} resetKeys={[resetKey]} onError={onError} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}

function SceneErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" data-flute-error="">
      <strong>Unable to render the Flute scene.</strong>
      <p>{message}</p>
      <p>Correct the component or scene configuration, then retry.</p>
      <button type="button" onClick={resetErrorBoundary}>
        Retry scene
      </button>
    </div>
  );
}

export { useSceneCapture } from "./capture";
