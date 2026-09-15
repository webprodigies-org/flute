import { z } from "zod";
import { FLUTE_BRAND } from "./branding";
import { SceneRecipeSchema, SCENE_RECIPE_DIRECTORY } from "./recipes";
import { CameraSchema, FocusSchema, SceneSchema, TransformSchema, SCENE_BACKGROUND } from "./scene";
import { MotionSchema, MotionTrackSchema, MotionKeyframeSchema, motionDuration } from "./motion";
import { CascadeSchema } from "./choreography";
import { SUPPORTED_EXPORT_FPS, CaptureManifestSchema } from "./export";

/** SOURCE OF TRUTH: getAuthoringGuide, reviewAuthoring, AuthoringGuideSchema.
 * WHAT: versioned cinematic concepts, actual capabilities and non-prescriptive review.
 * WHY: agents and other clients share a language, not a fixed shot or copied prompt.
 * WHERE: RESOURCES binds these pure operations; CLI guide and package consumers use them.
 * Schemas own technical limits; advice never rejects an intentional artistic choice.
 */
const ConceptSchema = z.strictObject({
  id:z.string(), title:z.string(), meaning:z.string(), mechanism:z.string(),
  choices:z.string(), pitfalls:z.string(), verify:z.string(),
});
export const AuthoringGuideSchema = z.strictObject({
  version:z.literal(2), purpose:z.string(), creativeFreedom:z.string(), stageBackdrop:z.literal(SCENE_BACKGROUND),
  concepts:z.array(ConceptSchema), workflow:z.array(z.string()),
  capabilities:z.record(z.string(),z.unknown()),
});
export type AuthoringGuide = z.infer<typeof AuthoringGuideSchema>;
const concepts: z.infer<typeof ConceptSchema>[] = [
 {id:"spatial",title:"Real UI becomes spatial material",
 meaning:"A cinematic UI scene reveals a recognizable product through depth, changing viewpoint and directed attention in black void space. Tight oblique detail, a receding app plane and layered fragments should read as views of the same real application, not unrelated objects floating in a presentation. It is not inherently a slideshow, a device screenshot, a new dashboard design or a collection of decorative rotations.",
 mechanism:"Scene establishes a black void viewport and camera. Its SCENE_BACKGROUND contract owns the black backdrop; retain that same color around the capture frame. This never recolors the actual UI on a Surface. Surface places an existing React subtree in that space; nested surfaces inherit parent transforms. Motion is a positioning alias for Surface. Layout stays in CSS, spatial transforms belong to Flute. Surface morphing here means changing position, orientation, scale and composition, not bending a mesh or deforming pixels.",
 choices:"Choose an identifiable subject and its relationship to the app. A close crop can isolate one important detail while framing, adjacent context or the unfolding reveal explains its place. Scattered unrelated elements without a product relationship miss the intended outcome. Choose meaningful content from the requested page: a whole page, a panel, a few related elements, or a progression between detail and context. The user's intent determines what deserves attention. Depth, camera path, rhythm and focus may differ radically between scenes; no sidebar layout or reference shot is required.",
 pitfalls:"Do not recreate the host UI to make it easier to animate, replace its theme, copy its fetch logic, or assume that installation invents a shot. Keep original providers and components. Use a dedicated branch when useful without changing the user's branch automatically.",
 verify:"Compare the ordinary page and the scene for styling, content, interactions and component identity. There should be one rendered instance of each chosen live component, not sharp/blurred clones."},
 {id:"camera",title:"Viewpoint creates the reveal",
 meaning:"Compose the camera first. The default outcome is a dramatic close oblique view of a large app surface in a black void: one side or corner is visibly near and the opposite side recedes. The camera travels across that surface. A small centered panel moving around the frame does not establish this visual language. Dramatic perspective can come from a fixed viewing angle and close distance; it does not require animated rotation.",
 mechanism:"Coordinates use pixels and degrees: +x right, +y down, +z toward the viewer. Camera xyz subtracts from scene positions; camera rotation uses stage-rotation convention, not an inverse physical camera pose. In an untilted scene, increasing camera z makes a surface recede, decreasing it brings it closer. Rotation complicates apparent axes: use matrixFor/multiply for local-axis paths instead of copying transform math. CSS perspective sets projection strength; it is not focal length or an animatable camera track. There is no physical lens API.",
 choices:"First choose the near edge or corner, the detail to frame, viewing distance and a travel axis along the page. Any side or corner can lead: bottom looking upward, top looking downward, left-near/right-far or the reverse. Keep the page pose stable for a camera survey and animate camera translation along one surface-aligned direction. Several xyz tracks can express one diagonal rail; they must share timing/easing. Keep viewing angle steady unless an intentional reveal needs rotation. Surface motion belongs to assembly, floating or deliberate object choreography, not a substitute for camera travel. Creator overrides remain valid.",
 pitfalls:"An arbitrary 360-degree spin usually hides the product. Avoid large, competing rotations or oscillation without a reason. Positive z is not unlimited: crossing the CSS projection plane causes clipping or explosive perspective. An entrance that feels behind the viewer should begin offscreen or faded near the view and settle into visible space, not pass through the projection singularity. Keep depth ranges modest relative to perspective and inspect the full path.",
 verify:"Scrub beginning, middle, end and intermediate frames. Confirm the target remains readable, projected surfaces do not disappear or invert, and camera movement advances the narrative instead of merely adding motion."},
 {id:"focus",title:"Depth of field belongs to the camera",
 meaning:"A camera focuses a plane at a distance along its viewing axis. Different objects at the same depth can be sharp together; screen position does not decide sharpness. Moving or turning the camera changes the depth of each visible point, so the in-focus region moves over the real UI naturally.",
 mechanism:"Scene version 3 owns focus {distance, fStop, focalLength, maxBlur}. Distance and focalLength use the same scene units; distance must exceed focalLength. Camera projection is at +perspective, so a camera-space point z has depth perspective-z. Animate focus.distance to rack focus; raise fStop for deeper, gentler focus and lower it for shallow focus. Start with defaults (fStop 8, focalLength 50, maxBlur 6), then set distance for the intended subject. No circle, radius, falloff, target ID or manual filter is needed. The canonical thin-lens calculation produces a local blur kernel before CSS projection, avoiding double magnification.",
 choices:"Keep focus distance fixed for a camera survey, or animate it independently for a focus pull. Judge foreground and background together at actual output size. Prefer gentle softness over destroying readability; change aperture before increasing the blur cap. Screen-separated objects at the focal plane correctly remain sharp.",
 pitfalls:"Version 2 radial focus fields are rejected instead of being silently reinterpreted. Native DOM rendering approximates aperture blur with Gaussian basis kernels; it does not reproduce Blender's aperture-shaped bokeh, ray-traced occlusion or lens artifacts. Every visible text/media region must belong to a visual Surface leaf or content. A spatial group cannot blur its descendants without flattening them; uncovered content produces diagnostics and capture refuses an invalid scene.",
 verify:"Check equal-depth subjects on opposite screen sides, a nearer and farther subject, and a tilted plane. Camera rotation/translation and focus-distance changes must change actual sharpness. Inspect background/sidebar/header coverage, styles and state. Pass browser pixel and performance checks; metadata does not certify optical or artistic fidelity."},
 {id:"parallax",title:"Depth makes layers relate",
 meaning:"Parallax is the different apparent movement of near and far content when the viewpoint changes. A grouping of elements feels spatial when their depth and motion reveal a relationship, not just when every item has the same offset.",
 mechanism:"Extract meaningful existing subtrees into stable Surface wrappers. Different z positions under perspective create differential scale and motion. Parent surfaces carry child layers; local coordinates belong to their parent. createCascadeTracks provides ordered varying depth with overlapping eased settling. It is one optional composition mechanism, not the definition of a cinematic scene.",
 choices:"Depth may reveal hierarchy, assembly, separation, comparison or a passage from detail to context. A linked cascade can feel like a string of elements settling; another shot can use simultaneous motion, quiet depth layers, or independent emphasis. Choose decomposition according to the content and user request. A group can approach from offscreen, recede or settle without all shots repeating a staircase.",
 pitfalls:"More layers is not always better. Avoid arbitrary splitting of every character or huge numbers of filtered surfaces. Do not detach labels from meaning. A flat synchronized stack creates little depth contrast; excessive separation breaks the perceived relationship to the original UI.",
 verify:"Compare relative positions at multiple times. Verify near/far layers actually change their projected relationship, then resolve into a coherent arrangement rather than permanently overlapping unreadable content."},
 {id:"surface-travel",title:"Technique: travel along a monumental surface",
 meaning:"Close camera placement and foreshortening make an ordinary page feel like a massive screen extending into the void. This is a composition family, not a fixed layout or numeric preset.",
 mechanism:"Keep the page transform fixed. Establish the near edge with camera orientation and distance, then translate the camera along the projected page tangent. This renderer composes camera translation before stage rotation: derive the tangent using the canonical matrixFor/multiply rotation matrices, including ancestor surface orientation, rather than assuming camera y follows a tilted page. Use a direction, with no translation component. A single rail may require correlated x/y/z tracks with matching endpoints and easing; never copy spatial math.",
 choices:"Choose any edge or corner and either direction of travel. Crop beyond the capture frame when that conveys scale; preserve a recognizable detail and a receding edge. Hold the angle and distance relationship through the survey. A slow dolly toward or away from the plane is a separate intentional move.",
 pitfalls:"Do not automatically fit the whole page, level the tilt at the end, pan unrelated screen axes, or animate page position to fake the requested camera track. Avoid crossing the projection plane.",
 verify:"Approve a still frame before animation: visible near/far size difference, dramatic crop, black void and depth-driven sharp-to-soft transition. At several times verify the page pose is unchanged and the camera follows the intended edge without drifting away from the subject."},
 {id:"plating",title:"Technique: plating a page together",
 meaning:"Recognizable sections converge from separated depth into their original page positions while an oblique camera travels across them. Assembly is purposeful object motion paired with a camera shot.",
 mechanism:"Start from the final host layout and stable wrappers. Give related pieces distinct local depth/offsets, then settle them to their original slots using canonical motion/cascade tracks. Animate the camera on its own rail; an opposing direction can increase relative foreground/background travel. Keep original backing paint and live UI identity.",
 choices:"Choose a few meaningful sections and an order or overlapping linked cascade. Vary starting distance, direction and timing; a staircase is optional. Keep enough of the receiving page or neighboring pieces visible to explain where each piece belongs.",
 pitfalls:"A set of unrelated panels drifting forever is not plating. Do not flatten the camera angle to make assembly easier, redraw the page, or let excessive counter-motion make the result unreadable.",
 verify:"Inspect both the dramatic starting composition and final registration against the original page. Check visible relative depth during convergence, focal-plane crossing and no overlap errors in the assembled result."},
 {id:"microzoom",title:"Technique: an extreme detail shot",
 meaning:"The camera is close enough that a small real control, icon or label becomes the subject of the frame, while surrounding UI recedes diagonally out of view.",
 mechanism:"Use camera distance and translation to frame the existing detail on an oblique plane. Keep its host subtree intact. Set focus.distance to that detail's camera-axis depth and use aperture for gentle separation; travel a short distance along the plane.",
 choices:"Choose a meaningful detail from the requested page. An icon need not be centered; its neighboring text or surface edge can establish context. Change edge, corner and travel direction instead of copying one reference crop.",
 pitfalls:"Scaling an isolated icon against empty black is not the same camera shot. Do not zoom until the projection clips or blur the entire subject. Preserve original typography and paint.",
 verify:"At output size the chosen detail is identifiable, its nearby surface shows perspective recession, and adjacent content becomes progressively softer. Confirm the short camera rail retains the detail."},
 {id:"floating",title:"Technique: floating foreground with depth context",
 meaning:"A lifted control or section reads as floating because a related page or other surface remains visibly behind it. Black void is the stage; it is not a substitute for the background subject needed to demonstrate relative parallax.",
 mechanism:"Place the existing foreground subtree on a nearer Surface and retain a distinct related background Surface. Translate the camera so their projected positions change differently. Gentle foreground motion may supplement that move. Use canonical depth of field to distinguish depth without erasing all background structure.",
 choices:"Lift a sidebar, input, modal or meaningful section with its original backing paint. Leave some silhouette against the void and some overlap against the page when useful; choose separation according to the actual composition.",
 pitfalls:"One isolated object on black cannot demonstrate foreground/background relative motion. Two equal-depth layers or a completely obscured background also fail that evidence. Never duplicate the lifted UI in its old slot to manufacture depth.",
 verify:"In multiple frames both depth references remain visible, their relative positions change, and the lifted content still belongs visually to the app. Verify some background structure survives the blur."},
 {id:"motion",title:"Timing gives weight and continuity",
 meaning:"Gentle acceleration, measured travel and gentle settling make a reveal feel deliberate. The relationship between movements matters more than forcing one universal duration or trajectory.",
 mechanism:"MotionSchema owns half-speed playback and cinematic outgoing easing by default. Authored duration/keyframes use authored milliseconds; Scene timeMs is elapsed presentation milliseconds. motionDuration gives playback duration; useSceneTime gives the speed-adjusted authored time for charts. The cinematic curve has zero velocity and acceleration at endpoints. Multiple segments therefore settle at each keyframe; use a continuous segment when a camera should keep traveling.",
 choices:"Vary the sequence, depth relationship, direction, camera framing and focus behavior for different creative intentions. Overlap related entrances for continuity, allow moments of stillness for reading, and settle purposefully. Explicit speed, easing and cascade overrides belong to the creator. Native preview cadence follows the display; sampleFrameTime can simulate lower cadence without changing duration.",
 pitfalls:"Do not copy an easing evaluator or create independent clocks for camera, focus and surfaces. Linear movement or abrupt direction changes should be intentional, not an accidental omitted default. Longer timing alone does not fix an incoherent scene; excessive slowness can also lose attention.",
 verify:"Play at normal size and seek deterministically. Look for sudden velocity changes, needless pauses at camera waypoints and unrelated host animations running on another clock. Respect reduced motion by starting paused and offering seeking."},
 {id:"composition",title:"Preserve the live tree and its paint",
 meaning:"The host application is the visual source of truth. Spatial framing should reveal that design rather than silently redesign it.",
 mechanism:"Scene wraps stable Surface IDs. Ordinary leaf UI can be children; when a Surface groups other surfaces, put its background/decorations in content and its spatial children in children. Content is the filtered visual leaf; spatial groups retain preserve-3d. No manual filter stacking is needed. Group opacity does not fade all descendants: animate the actual visual leaves. Keep providers outside or in the original tree and keep wrapper identity stable during playback. Stable DOM identity alone does not prevent expensive React work: keep the composed host subtree stable (for example, memoized elements keyed by the recipe) while passing the changing clock to Scene. Only components deliberately consuming scene time should rerender for that clock.",
 choices:"Reuse the smallest meaningful component that preserves its data and styling dependencies. If a transparent element lifts from its background, it may need its original backing paint, not invented decoration. Host components may receive an existing supported progress/state prop driven by useSceneTime when internal animation is useful.",
 pitfalls:"Wrapper nodes can break direct-child selectors, flex/grid sizing, list semantics or inherited styling. Put li/tr/other semantic roots in the correct parent and adapt the wrapper placement. Host transforms, filters, opacity, overflow clipping and paint containment on spatial ancestors can flatten 3D; isolate those on visual leaves. Portals may leave the scene. Never duplicate React subtrees to fake focus.",
 verify:"Check normal and scene computed styles, keyboard and pointer interaction, provider requests and DOM identity. Visually inspect clipping, theme, menu behavior and responsive layout. A typecheck cannot prove visual fidelity."},
 {id:"delivery",title:"Inspect before exporting",
 meaning:"A scene is finished when its real rendered behavior communicates the intended reveal, not merely when its configuration validates.",
 mechanism:"Use ScenePreview from @webprodigies/flute/preview for the shared product interface. It owns paused playback, seek/replay, source validation/recovery, viewport fitting and the capture bridge, using the canonical Scene and motion clock. Supply stable Surface children and a definition containing scene metadata, optional motion, width and height. Pass hot={import.meta.hot} in Vite for update/error/reconnection feedback. For a deliberately custom low-level integration, Scene, motionDuration, SceneErrorBoundary and useSceneCapture remain available; do not register a second capture bridge inside ScenePreview. flute export samples the same live scene at exact frame times using FFmpeg; FPS controls cadence, not speed.",
 choices:"Preview first and revise code through the existing development server. Export only when requested, choosing the requested output cadence. The installed CLI does not need an AI login and does not infer a page's private data. Existing coding agents inspect the host project and use their own credentials/subscription tooling.",
 pitfalls:"Do not assume an agent will discover guidance without being directed to it: start with flute guide. reviewAuthoring validates the supplied scene/motion metadata and returns advisory checks, not a visual quality score or proof of actual DOM registration. No builder, template loader or autonomous AI service is provided here.",
 verify:"Run host types/build, inspect Scene diagnostics and actual registered IDs, scrub several frames, test interaction/reduced motion/mobile and measure playback. Register capture before exporting; use a fresh relative MP4 output path. Compare exported frames with preview and confirm duration/cadence. Record unresolved limits honestly."},
];
export function getAuthoringGuide(): AuthoringGuide {
  const {items: _items,...cascadeDefaults}=CascadeSchema.parse({items:[{id:"subject"}]});
  return AuthoringGuideSchema.parse({
    version:2,
    stageBackdrop:SCENE_BACKGROUND,
    purpose:"Compose cinematic 3D motion from a requested application's existing live UI. Teach a spatial language, not a prescribed design.",
    creativeFreedom:"Concepts explain effects and tradeoffs. The stage is always a black void; the host UI keeps its original theme. No fixed camera angle, path, layout, focus target, layer count or entrance pattern is mandatory. User direction overrides artistic defaults. Technical schema/identity constraints still apply. For multiple scenes choose different compositional ideas, not just different labels or durations.",
    concepts,
    workflow:[
      "Start with the project-root FLUTE.md handoff created by npx flute init. Read npx flute guide --json for this installed version, then inspect the requested page, original components, providers, styles and existing app entry. Do not start by copying a demo.",
      "Choose a shot family and layout relationship: surface travel, plating, micro detail or floating foreground, or a deliberate variation. State the near edge/corner, subject, camera distance, one travel axis, focus region and visible depth references. Choose camera framing before object animation.",
      "Approve the opening still visually before adding motion: strong near/far perspective, intentional close crop, identifiable detail and visible progressive focus in black void. Reject a small flat overview when the request calls for a dramatic shot. Reference images establish composition cues; motion direction comes from the brief, not a still image.",
      "Compose real components as stable Surface children of ScenePreview from @webprodigies/flute/preview, using canonical motion helpers and matching scene node metadata. Keep the normal app available. Use an authored scene route without flute-preview=1: that query activates the separate ProjectPreview bootstrap around the whole app. Do not nest the two previews. For automatic discovery instead use src/flute/scenes/<id>.scene.json plus matching <id>.tsx: the library owns ScenePreview around the selected component, so that component returns Surface content, not another preview shell.",
      "Use reviewAuthoring on the supplied metadata, host checks and the live scene diagnostics. Inspect actual browser frames and fix fidelity, framing, clipping and performance issues.",
      "Use the scene library at ?flute-preview=1. Adding a valid recipe/component pair automatically adds a row; ?flute-preview=1&flute-scene=<id> deep-links it. The installed entry must include the DEV-only sceneModules glob; rerun flute init to upgrade older wrappers. The catalog is code-driven, not a separate database. Native list scrolling keeps its camera/focus fixed. After creating or revising each scene, run flute snapshot --scene <id> --url <running-app-url> to save its real PNG thumbnail in the recipe; use --time <milliseconds> to choose a frame (default midpoint). Snapshots are local cached images of rendered host data, not live tile animations; regenerate them after changing the scene.",
      "Show the shared paused product preview. Revise source code from user feedback; do not recreate playback or diagnostic controls per scene. ScenePreview registers capture for static and animated scenes and exposes the canonical CLI export command when valid. Export only when requested.",
    ],
    capabilities:{
      brand:FLUTE_BRAND,
      example:{
        purpose:"A tested file-pair contract, not a mandatory composition. Replace the host import with the requested app's actual component and its existing providers. Choose framing, dimensions and focus for that content; do not recreate its UI.",
        recipePath:`${SCENE_RECIPE_DIRECTORY}/page-survey.scene.json`,
        componentPath:`${SCENE_RECIPE_DIRECTORY}/page-survey.tsx`,
        recipe:SceneRecipeSchema.parse({version:1,id:"page-survey",title:"Page survey",definition:{
          width:1400,height:980,
          scene:{camera:{perspective:1400,rotateY:-24,rotateX:10},focus:{distance:1400,fStop:5.6,focalLength:100,maxBlur:6},nodes:[{id:"page"}]},
          motion:{durationMs:6000,tracks:[{target:{kind:"camera"},property:"y",keyframes:[{timeMs:0,value:-100},{timeMs:6000,value:100}]}]},
        }}),
        componentSource:`import { Surface } from '@webprodigies/flute';
import { App, DashboardProvider } from '../../App';

export default function PageSurvey() {
  return <DashboardProvider><Surface id="page" style={{ width: 1400, height: 980 }}><App /></Surface></DashboardProvider>;
}
`,
      },
      sceneVersion:SceneSchema.parse({nodes:[]}).version,
      camera:CameraSchema.parse({}),focus:FocusSchema.parse({}),surface:TransformSchema.parse({}),
      motionDefaults:MotionSchema.parse({durationMs:0,tracks:[]}),
      tracks:MotionTrackSchema.options.map(option=>({target:option.shape.target.shape.kind.value,properties:[...option.shape.property.options]})),
      cascadeDefaults,
      easingDefault:MotionKeyframeSchema.parse({timeMs:0,value:0}).easing,
      exportFps:SUPPORTED_EXPORT_FPS,
      api:{
        hostIntegration:{
          contract:"Framework-independent React DOM 18.2+ / 19. Import ProjectPreview from @webprodigies/flute/preview, supply projectId, enabled (the host development flag), optional active (route-based opt-in), sceneModules (path -> async module loader), and original children. No Vite, Next, Node or Electron global is required by this React contract. ScenePreview/Scene/Surface work directly in any compatible React DOM renderer.",
          setup:"npx flute init detects Next App/Pages Router and standard Vite setups. Next adds /flute without rewriting layouts/config/providers; it returns 404 outside development. Unknown hosts get src/flute/ProjectPreview.jsx and FLUTE.md. --adapter react selects that portable connection explicitly even in a known framework. Follow init's integration.instructions: mount the generated wrapper inside required providers with enabled={yourDevelopmentFlag}; the query is ?flute-preview=1 or pass active for a dedicated route. For production code exclusion in a custom host, place the generated module import behind that bundler's compile-time development condition; a runtime enabled prop prevents activation but cannot erase imports from a build. Do not replace the host framework or create a new root.",
          registry:"After adding or deleting scene/component files outside the Vite glob, run npx flute sync. Edit JSON/components normally and let the host's HMR update them. Do not edit generated catalog.js or duplicate its loader. CLI discovery validates through the same core contract as the browser.",
          boundaries:"Next scenes are client components; do not import server-only modules or async Server Components into the client registry. Reuse client UI and pass required server data through the host boundary. Studio inherits route-layout providers; scene-specific providers belong in the scene binding. Electron uses this in its React renderer, never its main/preload process. Its security, navigation and bundler remain host-owned. React Native without DOM is outside this renderer. Unknown wrappers need one explicit host connection, not guessed entry rewrites.",
          example:"import {FluteProjectPreview} from './flute/ProjectPreview'; <ExistingProviders><FluteProjectPreview enabled={hostDevelopmentFlag}><ExistingApp /></FluteProjectPreview></ExistingProviders>",
        },
        recipes:"src/flute/scenes/<id>.scene.json contains {version:1,id,title,description?,definition:{scene,motion?,width?,height?}}. Lowercase slug id matches both filename and sibling <id>.tsx or <id>.jsx default component export (one, not both). The component returns actual Surface subtrees matching definition.scene.nodes; reuse original providers around those subtrees when needed. Do not render Scene/ScenePreview inside it: SceneLibrary supplies them. No serialized React instances, credentials or raw application records. An optional snapshot contains visible rendered pixels; generate it only for the local scene. Keep helpers outside the discovery directory. Unknown versions, missing bindings and duplicate IDs are rejected with repair diagnostics.",
        loadSceneRecipes:"({sources:[{path:'src/flute/scenes/id.scene.json',document:recipeObject}],bindingPaths:['src/flute/scenes/id.tsx'],sceneId?:'id'}) => {scenes,selected?,issues}. Validation does not execute TSX. CLI discovery and the browser adapter call this shared operation for you.",
        catalog:"flute scenes --json lists canonical validated recipes; flute load --scene ID --json returns that source; flute open --scene ID --url ORIGIN verifies the same host before opening the scene. Browser and CLI call loadSceneRecipes through RESOURCES. Vite discovers pairs through its development glob. Other hosts use npx flute sync after adding/removing pairs; their static registry uses ordinary imports and native hot reload. normal app routes and production stay ordinary. Recipe JSON is editable and survives refresh; playback state is in-memory.",
        ScenePreview:"Import from @webprodigies/flute/preview. {definition?:{scene:{version?:3,camera?,focus?,nodes:[{id,parentId?,transform?}]},motion?,width?,height?},children?,title?,backHref?,revision?,hot?}; dimensions default to 1400x980. Actual Surface children must match node metadata. No definition displays the empty product state. Owns playback/capture; do not pass a second timeMs or register another capture bridge. revision can signal source changes; Vite hosts pass import.meta.hot explicitly.",
        Scene:"{camera?,focus?,motion?,timeMs?,children?,style?,className?,onDiagnostics?}; no explicit nodes prop: the React adapter registers Surface children.",
        Surface:"{id,transform?,content?,children?,style?,className?}; id is unique within Scene. Motion is an alias, not a timeline component.",
        motion:"{durationMs,speed?,tracks:[{target:{kind:'surface',id}|{kind:'camera'}|{kind:'focus'},property,keyframes:[{timeMs,value,easing?}]}]}; properties listed above. No targetId, from/to, delay or duration shorthand.",
        reviewAuthoring:"({scene:{version?:3,camera?,focus?,nodes:[{id,parentId?,transform?}]},motion}) => {valid,issues,advice,requiresVisualReview:true}; only metadata, never React nodes or secrets.",
        helpers:"motionDuration, motionTime, evaluateMotion, createCascadeTracks, cinematicTimeAtProgress, sampleFrameTime, matrixFor, multiply: use installed TypeScript declarations for exact signatures.",
        capture:"useSceneCapture({durationMs:motionDuration(motion),seek}); seek pauses and sets Scene's elapsed time. Exactly one [data-flute-capture=\"scene\"] viewport per registered bridge.",
        export:"npx flute export --url HTTP_LOOPBACK_SCENE_URL --output fresh-name.mp4 --fps 60; requires FFmpeg and Playwright Chromium. Does not start the app server.",
      },
    },
  });
}
export const AuthoringReviewInputSchema=z.strictObject({scene:SceneSchema,motion:MotionSchema});
const ReviewIssueSchema=z.strictObject({code:z.string(),path:z.string(),message:z.string()});
export const AuthoringReviewSchema=z.strictObject({valid:z.boolean(),issues:z.array(ReviewIssueSchema),advice:z.array(ReviewIssueSchema),requiresVisualReview:z.literal(true)});
export type AuthoringReview=z.infer<typeof AuthoringReviewSchema>;
export function reviewAuthoring(input:unknown):AuthoringReview {
 const parsed=AuthoringReviewInputSchema.safeParse(input);
 if(!parsed.success)return {valid:false,issues:parsed.error.issues.map(i=>({code:"invalid-input",path:i.path.join('.'),message:i.message})),advice:[],requiresVisualReview:true};
 const {scene,motion}=parsed.data;
 const issues:AuthoringReview['issues']=[],advice:AuthoringReview['advice']=[];
 const ids=new Set(scene.nodes.map(n=>n.id));
 for(const [i,track] of motion.tracks.entries()) {
  if(track.target.kind==='surface'&&!ids.has(track.target.id))issues.push({code:'unknown-surface',path:`motion.tracks.${i}.target.id`,message:`No supplied surface ${track.target.id}. Compare with actual React registration too.`});
  if(track.property.startsWith('rotate')&&track.keyframes.some((f,k)=>k>0&&Math.abs(f.value-track.keyframes[k-1].value)>90))advice.push({code:'rotation-sweep',path:`motion.tracks.${i}`,message:'A rotation segment over 90 degrees may show the edge/back or hide the UI. Inspect the path; retain it only when intentional.'});
  if(track.keyframes.some((f,k)=>k<track.keyframes.length-1&&f.easing==='linear'&&f.value!==track.keyframes[k+1].value))advice.push({code:'linear-motion',path:`motion.tracks.${i}`,message:'Linear movement has no gentle start/finish. Confirm that this override serves the intended shot.'});
 }
 const changes=(track:typeof motion.tracks[number])=>track.keyframes.some(f=>f.value!==track.keyframes[0].value);
 const cameraTravels=motion.tracks.some(t=>t.target.kind==='camera'&&['x','y','z'].includes(t.property)&&changes(t));
 const surfacesMove=motion.tracks.some(t=>t.target.kind==='surface'&&['x','y','z','rotateX','rotateY','rotateZ','scale'].includes(t.property)&&changes(t));
 if(surfacesMove&&!cameraTravels)advice.push({code:'camera-travel-missing',path:'motion.tracks',message:'Surfaces move but the camera has no translational travel. Default dramatic shots establish a close oblique camera and a surface-aligned rail. Keep this stationary-camera variation only when intentional; element movement alone does not prove the requested shot.'});
 if(!motion.tracks.some(changes))advice.push({code:'static-scene',path:'motion',message:'There is no changing track. A static composition is valid, but does it meet a request for cinematic motion?'});
 if(scene.focus.maxBlur===0)advice.push({code:'sharp-scene',path:'scene.focus.maxBlur',message:'Focus softness is disabled initially. This can be intentional; inspect whether the composition still directs attention.'});
 if(motionDuration(motion)>0&&!CaptureManifestSchema.safeParse({version:1,durationMs:motionDuration(motion),selector:'[data-flute-capture="scene"]'}).success)advice.push({code:'export-duration',path:'motion.durationMs',message:'This timeline exceeds the current MP4 capture duration limit. Shorten it or present it without that export adapter.'});
 return {valid:issues.length===0,issues,advice,requiresVisualReview:true};
}
