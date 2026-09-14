import { z } from "zod";
import { CameraSchema, FocusSchema, SceneSchema, TransformSchema } from "./scene";
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
  version:z.literal(1), purpose:z.string(), creativeFreedom:z.string(),
  concepts:z.array(ConceptSchema), workflow:z.array(z.string()),
  capabilities:z.record(z.string(),z.unknown()),
});
export type AuthoringGuide = z.infer<typeof AuthoringGuideSchema>;
const concepts: z.infer<typeof ConceptSchema>[] = [
 {id:"spatial",title:"Real UI becomes spatial material",
 meaning:"A cinematic UI scene reveals the product through depth, changing viewpoint and directed attention. It is not inherently a slideshow, a device screenshot, a new dashboard design or a collection of decorative rotations.",
 mechanism:"Scene establishes a viewport and camera. Surface places an existing React subtree in that space; nested surfaces inherit parent transforms. Motion is a positioning alias for Surface. Layout stays in CSS, spatial transforms belong to Flute. Surface morphing here means changing position, orientation, scale and composition, not bending a mesh or deforming pixels.",
 choices:"Choose meaningful content from the requested page: a whole page, a panel, a few related elements, or a progression between detail and context. The user's intent determines what deserves attention. Depth, camera path, rhythm and focus may differ radically between scenes; no sidebar layout or reference shot is required.",
 pitfalls:"Do not recreate the host UI to make it easier to animate, replace its theme, copy its fetch logic, or assume that installation invents a shot. Keep original providers and components. Use a dedicated branch when useful without changing the user's branch automatically.",
 verify:"Compare the ordinary page and the scene for styling, content, interactions and component identity. There should be one rendered instance of each chosen live component, not sharp/blurred clones."},
 {id:"camera",title:"Viewpoint creates the reveal",
 meaning:"A camera move tells the viewer where to look. A close view makes detail legible; pulling back reveals relationships. A lateral or vertical move reveals relative depth, while restrained angle changes expose the surface plane.",
 mechanism:"Coordinates use pixels and degrees: +x right, +y down, +z toward the viewer. Camera xyz subtracts from scene positions; camera rotation uses stage-rotation convention, not an inverse physical camera pose. In an untilted scene, increasing camera z makes a surface recede, decreasing it brings it closer. Rotation complicates apparent axes: use matrixFor/multiply for local-axis paths instead of copying transform math. CSS perspective sets projection strength; it is not focal length or an animatable camera track. There is no physical lens API.",
 choices:"Use camera translation for a dolly in/out or a journey across content; surface scale changes an object rather than the viewpoint. Decide whether the subject moves, the viewpoint moves, or both, according to the reveal. A stationary camera can still produce strong spatial motion. Favor readable oblique views over turning a flat UI through its edge or backside unless the user deliberately asks for that.",
 pitfalls:"An arbitrary 360-degree spin usually hides the product. Avoid large, competing rotations or oscillation without a reason. Positive z is not unlimited: crossing the CSS projection plane causes clipping or explosive perspective. An entrance that feels behind the viewer should begin offscreen or faded near the view and settle into visible space, not pass through the projection singularity. Keep depth ranges modest relative to perspective and inspect the full path.",
 verify:"Scrub beginning, middle, end and intermediate frames. Confirm the target remains readable, projected surfaces do not disappear or invert, and camera movement advances the narrative instead of merely adding motion."},
 {id:"focus",title:"Focus is a spatial field of attention",
 meaning:"A clear region surrounded by progressively softer content separates foreground, subject and background. A narrow region isolates a detail; a wider region explains a relationship. Moving focus can transfer attention even while the camera stays still.",
 mechanism:"Focus is an independent camera-attached xyz point. It stays in one screen region while the scene moves underneath it; it does not follow a card ID. Radius sets the clear spherical region, falloff controls the transition distance, maxBlur caps softness. Flute computes progressive blur within each surface from spatial distance, in front and behind the field. This is a stylized spherical field, not a physical lens/depth-buffer simulation. A tilted surface can be partly sharp and partly soft.",
 choices:"Position the field where the subject passes through the projected composition, or animate xyz to travel between areas of interest. Animate radius/falloff to tighten or broaden attention. Coordinate those choices with the camera without requiring that both always move. Quiet or fully sharp shots remain valid when they communicate the intended idea.",
 pitfalls:"Do not apply CSS blur to a whole card, build custom mask/filter layers, use a radial smearing filter, or attach focus to an element. The canonical Scene renderer already owns the field and filter composition. Very broad radius removes separation; excessive blur hides the app and costs rendering work.",
 verify:"While seeking, confirm different parts of a tilted surface cross from clear to soft progressively; the focus region stays independent as surfaces move. Check the emphasized text at actual viewing size and avoid blurring everything at once."},
 {id:"parallax",title:"Depth makes layers relate",
 meaning:"Parallax is the different apparent movement of near and far content when the viewpoint changes. A grouping of elements feels spatial when their depth and motion reveal a relationship, not just when every item has the same offset.",
 mechanism:"Extract meaningful existing subtrees into stable Surface wrappers. Different z positions under perspective create differential scale and motion. Parent surfaces carry child layers; local coordinates belong to their parent. createCascadeTracks provides ordered varying depth with overlapping eased settling. It is one optional composition mechanism, not the definition of a cinematic scene.",
 choices:"Depth may reveal hierarchy, assembly, separation, comparison or a passage from detail to context. A linked cascade can feel like a string of elements settling; another shot can use simultaneous motion, quiet depth layers, or independent emphasis. Choose decomposition according to the content and user request. A group can approach from offscreen, recede or settle without all shots repeating a staircase.",
 pitfalls:"More layers is not always better. Avoid arbitrary splitting of every character or huge numbers of filtered surfaces. Do not detach labels from meaning. A flat synchronized stack creates little depth contrast; excessive separation breaks the perceived relationship to the original UI.",
 verify:"Compare relative positions at multiple times. Verify near/far layers actually change their projected relationship, then resolve into a coherent arrangement rather than permanently overlapping unreadable content."},
 {id:"motion",title:"Timing gives weight and continuity",
 meaning:"Gentle acceleration, measured travel and gentle settling make a reveal feel deliberate. The relationship between movements matters more than forcing one universal duration or trajectory.",
 mechanism:"MotionSchema owns half-speed playback and cinematic outgoing easing by default. Authored duration/keyframes use authored milliseconds; Scene timeMs is elapsed presentation milliseconds. motionDuration gives playback duration; useSceneTime gives the speed-adjusted authored time for charts. The cinematic curve has zero velocity and acceleration at endpoints. Multiple segments therefore settle at each keyframe; use a continuous segment when a camera should keep traveling.",
 choices:"Vary the sequence, depth relationship, direction, camera framing and focus behavior for different creative intentions. Overlap related entrances for continuity, allow moments of stillness for reading, and settle purposefully. Explicit speed, easing and cascade overrides belong to the creator. Native preview cadence follows the display; sampleFrameTime can simulate lower cadence without changing duration.",
 pitfalls:"Do not copy an easing evaluator or create independent clocks for camera, focus and surfaces. Linear movement or abrupt direction changes should be intentional, not an accidental omitted default. Longer timing alone does not fix an incoherent scene; excessive slowness can also lose attention.",
 verify:"Play at normal size and seek deterministically. Look for sudden velocity changes, needless pauses at camera waypoints and unrelated host animations running on another clock. Respect reduced motion by starting paused and offering seeking."},
 {id:"composition",title:"Preserve the live tree and its paint",
 meaning:"The host application is the visual source of truth. Spatial framing should reveal that design rather than silently redesign it.",
 mechanism:"Scene wraps stable Surface IDs. Ordinary leaf UI can be children; when a Surface groups other surfaces, put its background/decorations in content and its spatial children in children. Content is the filtered visual leaf; spatial groups retain preserve-3d. No manual filter stacking is needed. Group opacity does not fade all descendants: animate the actual visual leaves. Keep providers outside or in the original tree and keep wrapper identity stable during playback.",
 choices:"Reuse the smallest meaningful component that preserves its data and styling dependencies. If a transparent element lifts from its background, it may need its original backing paint, not invented decoration. Host components may receive an existing supported progress/state prop driven by useSceneTime when internal animation is useful.",
 pitfalls:"Wrapper nodes can break direct-child selectors, flex/grid sizing, list semantics or inherited styling. Put li/tr/other semantic roots in the correct parent and adapt the wrapper placement. Host transforms, filters, opacity, overflow clipping and paint containment on spatial ancestors can flatten 3D; isolate those on visual leaves. Portals may leave the scene. Never duplicate React subtrees to fake focus.",
 verify:"Check normal and scene computed styles, keyboard and pointer interaction, provider requests and DOM identity. Visually inspect clipping, theme, menu behavior and responsive layout. A typecheck cannot prove visual fidelity."},
 {id:"delivery",title:"Inspect before exporting",
 meaning:"A scene is finished when its real rendered behavior communicates the intended reveal, not merely when its configuration validates.",
 mechanism:"Use one controlled elapsed clock, motionDuration, Scene diagnostics and SceneErrorBoundary. Register useSceneCapture({durationMs,seek}) once; seek pauses and sets that same elapsed clock. Mark a fixed viewport data-flute-capture=\"scene\". flute export samples the live scene at exact frame times and uses FFmpeg; FPS controls cadence, not speed.",
 choices:"Preview first and revise code through the existing development server. Export only when requested, choosing the requested output cadence. The installed CLI does not need an AI login and does not infer a page's private data. Existing coding agents inspect the host project and use their own credentials/subscription tooling.",
 pitfalls:"Do not assume an agent will discover guidance without being directed to it: start with flute guide. reviewAuthoring validates the supplied scene/motion metadata and returns advisory checks, not a visual quality score or proof of actual DOM registration. No builder, template loader or autonomous AI service is provided here.",
 verify:"Run host types/build, inspect Scene diagnostics and actual registered IDs, scrub several frames, test interaction/reduced motion/mobile and measure playback. Register capture before exporting; use a fresh relative MP4 output path. Compare exported frames with preview and confirm duration/cadence. Record unresolved limits honestly."},
];
export function getAuthoringGuide(): AuthoringGuide {
  const {items: _items,...cascadeDefaults}=CascadeSchema.parse({items:[{id:"subject"}]});
  return AuthoringGuideSchema.parse({
    version:1,
    purpose:"Compose cinematic 3D motion from a requested application's existing live UI. Teach a spatial language, not a prescribed design.",
    creativeFreedom:"Concepts explain effects and tradeoffs. No fixed camera angle, path, layout, palette, focus target, layer count or entrance pattern is mandatory. User direction overrides artistic defaults. Technical schema/identity constraints still apply. For multiple scenes choose different compositional ideas, not just different labels or durations.",
    concepts,
    workflow:[
      "Read this installed-version guide, then inspect the requested page, original components, providers, styles and existing app entry. Do not start by copying a demo.",
      "Choose an intent and a coherent spatial relationship. Explain the chosen framing, attention and motion briefly; leave implementation and aesthetic choices open.",
      "Compose real components with the public Scene/Surface API and canonical motion helpers. Keep the normal app available; use an isolated scene route/query and stable identities.",
      "Use reviewAuthoring on the supplied metadata, host checks and the live scene diagnostics. Inspect actual browser frames and fix fidelity, framing, clipping and performance issues.",
      "Show an editable paused preview. Revise through code from user feedback. When requested, register capture and use the canonical CLI exporter.",
    ],
    capabilities:{
      sceneVersion:SceneSchema.parse({nodes:[]}).version,
      camera:CameraSchema.parse({}),focus:FocusSchema.parse({}),surface:TransformSchema.parse({}),
      motionDefaults:MotionSchema.parse({durationMs:0,tracks:[]}),
      tracks:MotionTrackSchema.options.map(option=>({target:option.shape.target.shape.kind.value,properties:option.shape.property.options})),
      cascadeDefaults,
      easingDefault:MotionKeyframeSchema.parse({timeMs:0,value:0}).easing,
      exportFps:SUPPORTED_EXPORT_FPS,
      api:{
        Scene:"{camera?,focus?,motion?,timeMs?,children?,style?,className?,onDiagnostics?}; no explicit nodes prop: the React adapter registers Surface children.",
        Surface:"{id,transform?,content?,children?,style?,className?}; id is unique within Scene. Motion is an alias, not a timeline component.",
        motion:"{durationMs,speed?,tracks:[{target:{kind:'surface',id}|{kind:'camera'}|{kind:'focus'},property,keyframes:[{timeMs,value,easing?}]}]}; properties listed above. No targetId, from/to, delay or duration shorthand.",
        reviewAuthoring:"({scene:{version?:2,camera?,focus?,nodes:[{id,parentId?,transform?}]},motion}) => {valid,issues,advice,requiresVisualReview:true}; only metadata, never React nodes or secrets.",
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
 if(!motion.tracks.some(t=>t.keyframes.some(f=>f.value!==t.keyframes[0].value)))advice.push({code:'static-scene',path:'motion',message:'There is no changing track. A static composition is valid, but does it meet a request for cinematic motion?'});
 if(scene.focus.maxBlur===0)advice.push({code:'sharp-scene',path:'scene.focus.maxBlur',message:'Focus softness is disabled initially. This can be intentional; inspect whether the composition still directs attention.'});
 if(motionDuration(motion)>0&&!CaptureManifestSchema.safeParse({version:1,durationMs:motionDuration(motion),selector:'[data-flute-capture="scene"]'}).success)advice.push({code:'export-duration',path:'motion.durationMs',message:'This timeline exceeds the current MP4 capture duration limit. Shorten it or present it without that export adapter.'});
 return {valid:issues.length===0,issues,advice,requiresVisualReview:true};
}
