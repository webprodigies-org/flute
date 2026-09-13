# Spatial and motion integration contract

Morphite Board owns scope and build order. Slice ad6d2430-a222-5b8f-a296-e24724f4a81d established live surfaces. Slice 588fd521-ca29-51af-a3f0-db5733e87380 extends that owner with independent progressive focus, camera translation and deterministic motion. This document describes the implemented interface, not another build plan.

Scene schemas live in src/core/scene.ts (version 2). Spatial evaluation, coordinate conventions and focus-mask generation live in src/core/spatial.ts. MotionSchema/evaluateMotion own explicit-time tracks in src/core/motion.ts. RESOURCES binds the current operation identities; React consumes it without copying their policy. See README for public usage and limitations.

Scene accepts camera, focus, motion, timeMs, children, style/className and onDiagnostics. Surface/Motion accept stable id, transform, children and optional content. useSceneTime exposes the same explicit time for opt-in component adapters. SceneErrorBoundary provides retry and resetKey recovery.

Registration is Scene-scoped with mount tokens and ResizeObserver cleanup. Measurements are untransformed border-box centers relative to the nearest registered parent or scene center. The renderer preserves provider context, DOM identity and interaction during prop/time changes. Visual leaves receive the progressive filter/opacity; spatial groups retain preserve-3d. Invalid input and removed motion targets recover without rebuilding the host subtree.

Focus is independent camera-space xyz plus radius/falloff/maxBlur, never a component ID. It stays screen-locked under camera movement. One field computes distance across each planar surface, including perpendicular depth. SVG Gaussian basis masks approximate that field on the existing SourceGraphic; there are no copied React subtrees or UI screenshots. data-flute-blur is center-point telemetry only, not the filter for the whole element.

Camera x/y/z subtract from scene position. Existing stage rotations remain in canonical T*Rx*Ry*Rz order; this is not a physical camera pose API. Focus position, camera position and surfaces can be keyframed independently.

Checks: npm run verify:motion. Pixel tests verify within-surface sharpness and fixed focus under movement; React checks verify state/registration recovery; architecture tests reject duplicate named owners and forbidden imports. Tests do not prove universal host CSS compatibility or physical optical accuracy.
