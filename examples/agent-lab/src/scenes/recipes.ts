import { reviewAuthoring, matrixFor, TransformSchema, type MotionInput, type SceneInput } from "@flute/scene";

// SOURCE OF TRUTH: recipes, host shot framing and camera rails.
// WHAT: close camera surveys and depth assembly of the existing dashboard.
// WHY: camera travel establishes perspective; local tracks only choreograph pieces.
// WHERE: gallery binds these IDs to the original dashboard's section slots.
type Track = NonNullable<MotionInput["tracks"]>[number];
const durationMs = 6000;
const track = (target: Track["target"], property: Track["property"], a: number, b: number, start = 0, end = durationMs): Track => ({target,property,keyframes:[{timeMs:start,value:a},{timeMs:end,value:b}]} as Track);
const layer = (id:string, a:number, start:number):Track => track({kind:"surface",id},"z",a,0,start,Math.min(durationMs,start+4400));
// Camera translation is in stage coordinates. Rotate a page tangent through the
// canonical matrix, then give all three coordinates the same eased segment.
function rail(pose: {rotateX:number;rotateY:number;rotateZ:number}, start: [number,number,number], axis: "x"|"y", distance:number):Track[] {
  const m=matrixFor(TransformSchema.parse(pose));
  const column=axis==="x"?0:1;
  return (["x","y","z"] as const).map((property,row)=>track({kind:"camera"},property,start[row],start[row]+m[row*4+column]*distance));
}
export type Recipe = {
  id:string; title:string; description:string; scene:SceneInput; motion:MotionInput;
  sections: boolean;
};
const surveyPose={rotateX:24,rotateY:-34,rotateZ:-9};
const platingPose={rotateX:28,rotateY:24,rotateZ:7};
const floatingPose={rotateX:32,rotateY:-28,rotateZ:-14};
export const recipes:Recipe[]=[
  {
    id:"surface-travel",title:"01 / Surface travel",
    description:"Close to the near edge. The camera glides down the tilted dashboard while the page stays still.",
    sections:false,
    scene:{camera:{perspective:1800,...surveyPose,x:-100,y:0,z:-610},focus:{distance:1498,fStop:2.8,maxBlur:6},nodes:[{id:"dashboard"}]},
    motion:{durationMs,tracks:rail(surveyPose,[-100,0,-610],"y",140)},
  },
  {
    id:"plating",title:"02 / Plating",
    description:"Real dashboard sections approach their original slots as the camera travels in the opposite direction.",
    sections:true,
    scene:{camera:{perspective:1800,...platingPose,x:210,y:-50,z:-360},focus:{distance:1440,fStop:2.8,maxBlur:6},nodes:[{id:"dashboard"},{id:"sidebar",parentId:"dashboard"},{id:"header",parentId:"dashboard"},{id:"metrics",parentId:"dashboard"},{id:"chart",parentId:"dashboard"},{id:"table",parentId:"dashboard"}]},
    motion:{durationMs,tracks:[...rail(platingPose,[210,-50,-360],"y",-160),layer("metrics",180,0),layer("chart",330,550),layer("table",480,1100)]},
  },
  {
    id:"floating",title:"03 / Floating detail",
    description:"A close oblique pass across the lifted visitor chart. The dashboard behind it supplies the second depth plane.",
    sections:true,
    scene:{camera:{perspective:1800,...floatingPose,x:120,y:80,z:-330},focus:{distance:1220,fStop:2.8,maxBlur:6},nodes:[{id:"dashboard"},{id:"sidebar",parentId:"dashboard"},{id:"header",parentId:"dashboard"},{id:"metrics",parentId:"dashboard"},{id:"chart",parentId:"dashboard",transform:{z:190}},{id:"table",parentId:"dashboard"}]},
    motion:{durationMs,tracks:rail(floatingPose,[120,80,-330],"x",220)},
  },
];
export const reviews=recipes.map(recipe=>reviewAuthoring({scene:recipe.scene,motion:recipe.motion}));
