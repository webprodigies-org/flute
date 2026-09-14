# Product

Flute lets developers compose existing app components into animated perspective scenes using their existing coding agent and subscription. The local MVP preserves live component providers, state, events and existing data/API integrations. Developers describe the desired scene; they should not need a screenshot-upload or element-selection workflow.

## Experience

Install in an existing project, compose real UI with Scene/Surface/Motion, and watch a live preview while refining it through prompts. Surfaces and camera can move separately; camera focus distance and aperture can be animated independently. Depth of field follows camera-axis depth, with equal-depth objects equally focused. Performance is a release priority.

## Delivered and remaining scope

Delivered: React wrappers, progressive focus, camera and layer motion, explicit-time playback, the local Storage demonstration with live provider/API-backed cards, a separate official shadcn dashboard consumer with an authored sidebar camera/entrance shot, cinematic motion defaults (half speed, soft easing, optional linked depth cascade), local MP4 capture at 30/60/120 FPS, and a local CLI/Vite adapter that installs and opens a development-only whole-app scene preview.

Remaining planned MVP slices: integrated preview refinement, editable saved recipes and coding-agent conventions. Morphite's matrix owns their order and acceptance criteria.

Product login, collaboration, hosted AI infrastructure and still-image export are outside the current MVP. Hosted studio, identity and commercial capabilities are future planning only. Existing app authentication/data remain the host application's responsibility.

See architecture.md for canonical technical ownership, boundaries and verification.

The user explicitly expanded this iteration to include downloadable MP4 video. Export uses the same scene clock as live preview; it does not depend on real-time playback keeping up. Default export is 60 FPS, with 30 and 120 FPS options. Native preview cadence follows the display and is distinct from an encoded frame rate.

The installed CLI teaches cinematic concepts through `flute guide`, backed by the same structured authoring contract available to package clients. It explains choices and their consequences rather than forcing a common design. Existing coding agents compose real UI through the canonical API; Flute does not supply an AI subscription, builder or automatic scene generation service. Technical validation and artistic advice are separate. A fresh GPT-6 Astra trial creating three distinct scenes tests discoverability without relying on the previous examples; its result does not guarantee every LLM will produce good art.

All scene backgrounds are black void space. The intended family is recognizable application surfaces viewed through deliberate perspective, spatial depth and progressive focus. Reference imagery informs those concepts only; it is not imported as an asset or prescribed as a copied shot. Isolated arbitrary elements without a product relationship are not the default outcome.

The initial three-scene trial passed technical checks but the user rejected its artistic outcome. It is not an accepted visual benchmark. The corrected default starts with a close, dramatic camera pose: one edge or corner near, the opposite side receding, a large surface extending through the frame, and visible progressive focus. Camera translation follows a surface-aligned rail while the page stays posed. Plating combines that camera shot with sections settling into their original slots; micro shots isolate a real detail on its page; floating shots retain visible related background geometry for parallax. These are compositional families with free framing and direction, not fixed templates. An opening still must establish the intended perspective and focus before motion is added; technical validation alone cannot certify that result.

The user superseded the original circular focus requirement with camera depth of field. Scene version 3 uses focus distance, aperture f-stop and focal length, with mild defaults. Native live-DOM filters approximate a lens kernel; aperture-shaped Blender bokeh and ray-traced inter-surface occlusion are not claimed. Unfiltered visible group content is a defect: diagnostics identify missing visual ownership, and export refuses invalid scenes. Existing example sidebar/header content must be covered along with animated sections.
