import { FOCUS_BANDS, focusMask, type EvaluatedNode } from "../core";
import DEPTH_X from "./depth-x.png";
import DEPTH_Y from "./depth-y.png";
/** SOURCE OF TRUTH: FocusFilter presentation.
 * WHAT: two cached linear depth textures and native SVG tables blend live Gaussian samples.
 * WHY: reuse cached raster ramps; never encode/decode image documents per frame.
 * WHERE: core/spatial supplies the canonical weights; Surface filters visual leaves.
 * Uses native feImage sampling and feComponentTransfer table interpolation.
 */
export function FocusFilter({ id, node }: { id: string; node: EvaluatedNode }) {
  const { focus: f, width, height } = node;
  const pad = (3 * f.maxBlur) / f.scale;
  const masks = Array.from({ length: FOCUS_BANDS + 1 }, (_, i) =>
    focusMask(f, width, height, i),
  );
  const mask = masks[0];
  // Zero-weight kernels contribute no pixels. Keep only active bands so many
  // small live layers do not pay for every possible blur radius.
  const bands = masks.map((mask, index) => ({mask, index}))
    .filter(({mask}) => mask.stops.some(weight => weight > 0));

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <filter
          id={id}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          x={-pad}
          y={-pad}
          width={width + 2 * pad}
          height={height + 2 * pad}
          colorInterpolationFilters="sRGB"
        >
          <feImage href={DEPTH_X} x={-pad} y={-pad} width={width+2*pad} height={height+2*pad} preserveAspectRatio="none" result="axisX" />
          <feComponentTransfer in="axisX" result="depthX"><feFuncA type="table" tableValues={mask.reverseX ? "1 0" : "0 1"} /></feComponentTransfer>
          <feImage href={DEPTH_Y} x={-pad} y={-pad} width={width+2*pad} height={height+2*pad} preserveAspectRatio="none" result="axisY" />
          <feComponentTransfer in="axisY" result="depthY"><feFuncA type="table" tableValues={mask.reverseY ? "1 0" : "0 1"} /></feComponentTransfer>
          <feComposite in="depthX" in2="depthY" operator="arithmetic" k2={mask.xWeight} k3={mask.yWeight} result="depth" />
          {bands.map(({mask, index: i}, position) => (
            <FilterBand
              key={i}
              index={i}
              node={node}
              weights={mask.stops}
              previous={position ? bands[position - 1].index : undefined}
            />
          ))}
        </filter>
      </defs>
    </svg>
  );
}
function FilterBand({
  index: i,
  node,
  weights,
  previous,
}: {
  index: number;
  node: EvaluatedNode;
  weights: number[];
  previous?: number;
}) {
  const { focus: f, width, height } = node;

  return (
    <>
      <feGaussianBlur
        in="SourceGraphic"
        stdDeviation={(f.maxBlur * i) / FOCUS_BANDS / f.scale}
        result={`blur${i}`}
      />
      <feComponentTransfer
        in="depth"
        x={(-3 * f.maxBlur) / f.scale}
        y={(-3 * f.maxBlur) / f.scale}
        width={width + (6 * f.maxBlur) / f.scale}
        height={height + (6 * f.maxBlur) / f.scale}
        result={`mask${i}`}
      >
        <feFuncA
          type="table"
          tableValues={weights.join(" ")}
        />
      </feComponentTransfer>
      <feComposite
        in={`blur${i}`}
        in2={`mask${i}`}
        operator="in"
        result={`part${i}`}
      />
      {previous === undefined ? (
        <feComposite
          in={`part${i}`}
          in2={`part${i}`}
          operator="arithmetic"
          k2={1}
          result={`sum${i}`}
        />
      ) : (
        <feComposite
          in={`sum${previous}`}
          in2={`part${i}`}
          operator="arithmetic"
          k2={1}
          k3={1}
          result={`sum${i}`}
        />
      )}
    </>
  );
}
