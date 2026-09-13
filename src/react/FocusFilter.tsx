import { FOCUS_BANDS, focusMask, type EvaluatedNode } from "../core";
import RADIAL_INPUT from "./radial-mask.png";
// Generated once with the browser's native radial gradient; see
// scripts/generate-focus-mask.mjs. Every surface shares this decoded texture.
/** SOURCE OF TRUTH: FocusFilter presentation.
 * WHAT: one cached radial texture and native SVG tables blend live Gaussian samples.
 * WHY: keep a stable filter graph; never encode/decode image documents per frame.
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
  const radius = mask.radius;
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
          <feImage
            href={RADIAL_INPUT}
            x={mask.x - radius}
            y={mask.y - radius}
            width={2 * radius}
            height={2 * radius}
            preserveAspectRatio="none"
            result="radial"
          />
          {Array.from({ length: FOCUS_BANDS + 1 }, (_, i) => (
            <FilterBand
              key={i}
              index={i}
              node={node}
              weights={masks[i].stops}
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
}: {
  index: number;
  node: EvaluatedNode;
  weights: number[];
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
        in="radial"
        x={(-3 * f.maxBlur) / f.scale}
        y={(-3 * f.maxBlur) / f.scale}
        width={width + (6 * f.maxBlur) / f.scale}
        height={height + (6 * f.maxBlur) / f.scale}
        result={`mask${i}`}
      >
        <feFuncA
          type="table"
          tableValues={weights.slice().reverse().join(" ")}
        />
      </feComponentTransfer>
      <feComposite
        in={`blur${i}`}
        in2={`mask${i}`}
        operator="in"
        result={`part${i}`}
      />
      {i === 0 ? (
        <feComposite
          in="part0"
          in2="part0"
          operator="arithmetic"
          k2={1}
          result="sum0"
        />
      ) : (
        <feComposite
          in={`sum${i - 1}`}
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
