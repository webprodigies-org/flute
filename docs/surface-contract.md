# Slice one integration contract

Board slice ad6d2430-a222-5b8f-a296-e24724f4a81d owns delivery. This file records the agreed implementation interface, not a replacement build plan.

Core owner: src/core/scene.ts and spatial.ts. The React adapter consumes validateScene/evaluateScene/transformToCss. Types derive from Zod. Component instances and host API data never enter SceneDefinition.

React public interface to implement in src/react/index.tsx:

- Scene: children, camera?: CameraInput, focus?: FocusInput, className?, style?, onDiagnostics?: (issues: SceneIssue[]) => void.
- Surface: id: string, transform?: TransformInput, children, className?, style?, content?: ReactNode.
- Motion: same as Surface, positioning only in slice one (no timeline).
- SceneErrorBoundary: children, optional resetKey; actionable error fallback with retry.
- Surface/Motion wrappers remain mounted on transform/focus changes, preserving host providers and events.
- data-flute-id on transform wrapper; data-flute-content on visual content leaf; data-flute-blur and data-flute-depth on wrapper for diagnostics/browser assertions.
- CSS 3D group wrappers never carry filter/opacity that flatten descendants. Optional content is a separate visual leaf; nested Surface/Motion children form the spatial group. Document limitations for arbitrary intermediary host clipping/filters.
- Natural measured dimensions through ResizeObserver; core receives local center offsets relative to nearest registered parent center (or scene center). Dimensions are untransformed, not getBoundingClientRect after 3D projection.
- Invalid config, duplicate IDs and missing focus targets produce visible actionable errors and recover on correction. Registration is scoped per Scene and cleaned up under StrictMode/unmount.
- Root scene uses perspective; stage camera rotation must exactly match core conventions. Do not copy blur or transform math into adapter.
- DOM wrappers should be neutral by default and allow consumer styling. Demo will supply layout.

Coordinator owns demo/, index.html, root config, README, tests/browser, src/index.ts.
React worker owns src/react/ and tests/react/.
Architecture worker owns scripts/check-architecture.mjs and tests/architecture.test.mjs.
Core files are a shared committed prerequisite. Propose core contract changes to coordinator before editing.

Checks: npm run test:core; npm run test:react; npm run test:architecture; npm run verify:surface on integrated root.
