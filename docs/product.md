# Product

Flute lets developers compose existing app components into animated perspective scenes using their existing coding agent and subscription. The local MVP preserves live component providers, state, events and existing data/API integrations. Developers describe the desired scene; they should not need a screenshot-upload or element-selection workflow.

## Experience

Install in an existing project, compose real UI with Scene/Surface/Motion, and watch a live preview while refining it through prompts. Surfaces, camera and an independent 3D focal point can move separately. Focus produces progressive radial blur across surfaces and can tighten or widen. Performance is a release priority.

## Delivered and remaining scope

Delivered: React wrappers, progressive focus, camera and layer motion, explicit-time playback, the local Storage demonstration with live provider/API-backed cards, a separate official shadcn dashboard consumer with an authored sidebar camera/entrance shot, cinematic motion defaults (half speed, soft easing, optional linked depth cascade), local MP4 capture at 30/60/120 FPS, and a local CLI/Vite adapter that installs and opens a development-only whole-app scene preview.

Remaining planned MVP slices: integrated preview refinement, editable saved recipes and coding-agent conventions. Morphite's matrix owns their order and acceptance criteria.

Product login, collaboration, hosted AI infrastructure and still-image export are outside the current MVP. Hosted studio, identity and commercial capabilities are future planning only. Existing app authentication/data remain the host application's responsibility.

See architecture.md for canonical technical ownership, boundaries and verification.

The user explicitly expanded this iteration to include downloadable MP4 video. Export uses the same scene clock as live preview; it does not depend on real-time playback keeping up. Default export is 60 FPS, with 30 and 120 FPS options. Native preview cadence follows the display and is distinct from an encoded frame rate.

The installed CLI teaches cinematic concepts through `flute guide`, backed by the same structured authoring contract available to package clients. It explains choices and their consequences rather than forcing a common design. Existing coding agents compose real UI through the canonical API; Flute does not supply an AI subscription, builder or automatic scene generation service. Technical validation and artistic advice are separate. A fresh GPT-6 Astra trial creating three distinct scenes tests discoverability without relying on the previous examples; its result does not guarantee every LLM will produce good art.

All scene backgrounds are black void space. The intended family is recognizable application surfaces viewed through deliberate perspective, spatial depth and progressive focus. Reference imagery informs those concepts only; it is not imported as an asset or prescribed as a copied shot. Isolated arbitrary elements without a product relationship are not the default outcome.
