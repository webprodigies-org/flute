import { describe, expect, it } from "vitest";
import ts from "typescript";
import { generatedPreview, inspectEntry } from "../../src/project/vite";

const projectId = "36c238cf-44e8-43be-b72a-e5196b075598";
const original = 'import { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")).render(<Provider><App /></Provider>);\n';

describe("installed React refresh module contract", () => {
  it.each(["src/main.tsx", "src/main.jsx", "main.tsx", "src/nested/main.jsx"])("generates parseable component-only discovery for %s", entry => {
    const adapter = generatedPreview(entry);
    const adapted = inspectEntry(original, entry, projectId);
    const again = inspectEntry(adapted.text, entry, projectId);
    expect(again).toEqual({text: adapted.text, integrated: true});
    expect(adapted.text).toContain(`from "${adapter.specifier}"`);
    expect(adapted.text).toContain('{<Provider><App /></Provider>}');
    expect(adapted.text).not.toContain("import.meta.glob");
    expect(adapted.text).not.toContain("import.meta.hot");
    expect(adapter.path).toBe(`src/flute/ProjectPreview.${entry.endsWith(".jsx") ? "jsx" : "tsx"}`);
    const parsed = ts.createSourceFile(adapter.path, adapter.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const exports = parsed.statements.filter(statement => ts.canHaveModifiers(statement)
      && ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    expect(exports).toHaveLength(1);
    expect(ts.isFunctionDeclaration(exports[0])).toBe(true);
    const compiled = ts.transpileModule(adapter.text, {fileName: adapter.path, reportDiagnostics: true,
      compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}});
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.outputText).toContain('export function FluteProjectPreview(props)');
    expect(compiled.outputText).toContain('import.meta.env.DEV ? import.meta.glob(');
    expect(compiled.outputText).toContain('hot: import.meta.hot');
    expect(compiled.outputText).not.toMatch(/hot\.(accept|on|dispose)|createRoot|window\./);
    if (entry.endsWith(".jsx")) expect(adapter.text).not.toMatch(/import type|ComponentProps|Omit</);
  });
  it("rejects new wrapper props which would bypass the adapter's discovery or hot ownership", () => {
    const text = inspectEntry(original, "src/main.tsx", projectId).text;
    for (const prop of [' hot={import.meta.hot}', ' sceneModules={{}}', ' {...other}']) {
      expect(() => inspectEntry(text.replace('enabled={import.meta.env.DEV}', 'enabled={import.meta.env.DEV}' + prop), "src/main.tsx", projectId))
        .toThrow(expect.objectContaining({code: "conflict"}));
    }
  });
  it("refuses an entry occupying the adapter target", () => {
    expect(() => inspectEntry(original, "src/flute/ProjectPreview.tsx", projectId)).toThrow(expect.objectContaining({code: "conflict"}));
  });
});
