import { FOCUS_BANDS, focusMask, type EvaluatedNode } from "../core";
/** SOURCE OF TRUTH: FocusFilter presentation.
 * WHAT: composite weighted Gaussian samples of the original live DOM graphic.
 * WHY: preserves one component instance while sharpness varies within its pixels.
 * WHERE: core/spatial owns all mask/distance rules; Surface applies the SVG URL
 * only to visual leaves so nested 3D groups never flatten here.
 */
export function FocusFilter({ id, node }: { id: string; node: EvaluatedNode }) {
  const { focus: f, width, height } = node;
  const pad = (3 * f.maxBlur) / f.scale;
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
          {Array.from({ length: FOCUS_BANDS + 1 }, (_, i) => (
            <FilterBand key={i} index={i} node={node} pad={pad} />
          ))}
        </filter>
      </defs>
    </svg>
  );
}
function FilterBand({
  index: i,
  node,
  pad,
}: {
  index: number;
  node: EvaluatedNode;
  pad: number;
}) {
  const { focus: f, width, height } = node;
  return (
    <>
      <feGaussianBlur
        in="SourceGraphic"
        stdDeviation={(f.maxBlur * i) / FOCUS_BANDS / f.scale}
        result={`blur${i}`}
      />
      <feImage
        href={focusMask(f, width, height, i)}
        x={-pad}
        y={-pad}
        width={width + 2 * pad}
        height={height + 2 * pad}
        preserveAspectRatio="none"
        result={`mask${i}`}
      />
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
