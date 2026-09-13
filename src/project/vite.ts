import ts from "typescript";
import { fault } from "./errors";

/** SOURCE OF TRUTH: Vite React source adaptation.
 * WHAT: inspect static single-entry Vite configuration and the imported React root.
 * WHY: text surgery preserves original providers, comments and formatting without executing config.
 * WHERE: commands.ts supplies file text; services.ts alone reads or writes files.
 */
const alias = "FluteProjectPreview";
const moduleName = "@flute/scene/preview";
function unsupported(message: string): never { throw fault("unsupported-project", message); }
function parse(source: string, filename: string) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length)
    unsupported("Fix source syntax errors before initializing Flute.");
  return file;
}
function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}
export function htmlEntry(html: string, devServer = false): string {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/<base\b/i.test(clean)) unsupported("HTML base elements are unsupported; use a root Vite entry.");
  const tags = [...clean.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)];
  const entries: string[] = [];
  for (const tag of tags) {
    const attributes = [...tag[1].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)];
    if (/\btype\s*=/.test(tag[1]) && !attributes.some(item => item[1].toLowerCase() === "type"))
      unsupported("Use quoted script type attributes for an unambiguous Vite entry.");
    const types = attributes.filter(item => item[1].toLowerCase() === "type");
    const sources = attributes.filter(item => item[1].toLowerCase() === "src");
    if (types.length === 1 && types[0][3] === "module") {
      if (devServer && sources.length === 1 && sources[0][3] === "/@vite/client") continue;
      if (devServer && !sources.length && /import\s+(?:RefreshRuntime|\{\s*injectIntoGlobalHook\s*\})\s+from\s+[\'"]\/@react-refresh[\'"]/.test(tag[0])) continue;
      if (sources.length !== 1) unsupported("Use one external TSX or JSX module in index.html.");
      entries.push(devServer ? sources[0][3].replace(/\?t=\d+$/, "") : sources[0][3]);
    }
  }
  if (entries.length !== 1 || !/^\/?[\w./-]+\.(tsx|jsx)$/.test(entries[0]))
    unsupported("Use one unambiguous TSX or JSX module entry in index.html.");
  return entries[0].replace(/^\//, "");
}
export function inspectConfig(source: string, filename: string) {
  const file = parse(source, filename);
  const imports = new Map<string, string>();
  let config: ts.Expression | undefined;
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const name = statement.moduleSpecifier.text;
      if (!["vite", "@vitejs/plugin-react", "@vitejs/plugin-react-swc"].includes(name))
        unsupported("Custom Vite config imports require manual adaptation.");
      const clause = statement.importClause;
      if (clause?.name) imports.set(clause.name.text, name);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
        for (const binding of clause.namedBindings.elements) {
          if ((binding.propertyName ?? binding.name).text !== "defineConfig") unsupported("Unsupported Vite config import.");
          imports.set(binding.name.text, name + ":defineConfig");
        }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && !config) config = statement.expression;
    else unsupported("Use a static Vite defineConfig object; dynamic config requires manual adaptation.");
  }
  if (config && ts.isCallExpression(config) && ts.isIdentifier(config.expression)
    && imports.get(config.expression.text) === "vite:defineConfig" && config.arguments.length === 1)
    config = config.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) unsupported("Use a static Vite config object.");
  const seen = new Set<string>();
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property) || !property.name
      || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) unsupported("Computed/spread Vite configuration is unsupported.");
    const key = property.name.text;
    if (seen.has(key)) unsupported("Duplicate Vite configuration keys are ambiguous.");
    seen.add(key);
    if (key === "root" || key === "base") {
      if (!ts.isStringLiteral(property.initializer)
        || !(key === "base" ? ["/"] : [".", "./"]).includes(property.initializer.text))
        unsupported("Only a single project root with Vite base '/' is supported.");
    } else if (key === "plugins") {
      if (!ts.isArrayLiteralExpression(property.initializer) || property.initializer.elements.length !== 1)
        unsupported("Only the standard Vite React plugin is supported automatically.");
      const plugin = property.initializer.elements[0];
      if (!ts.isCallExpression(plugin) || !ts.isIdentifier(plugin.expression) || plugin.arguments.length
        || !["@vitejs/plugin-react", "@vitejs/plugin-react-swc"].includes(imports.get(plugin.expression.text) ?? ""))
        unsupported("Custom Vite plugins/options require manual adaptation.");
    } else if (key === "server" || key === "preview") {
      // Literal server options do not alter source identity; middleware/proxy hooks are not accepted.
      if (!ts.isObjectLiteralExpression(property.initializer)) unsupported("Use literal Vite server options.");
      for (const option of property.initializer.properties) {
        if (!ts.isPropertyAssignment(option) || !ts.isIdentifier(option.name)
          || !["host", "port", "strictPort", "open"].includes(option.name.text)
          || !(ts.isStringLiteral(option.initializer) || ts.isNumericLiteral(option.initializer)
            || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(option.initializer.kind)))
          unsupported("Custom Vite server options require manual adaptation.");
      }
    } else unsupported("This Vite configuration requires manual adaptation: " + key + ".");
  }
}
export function inspectEntry(source: string, filename: string, projectId: string): { text: string; integrated: boolean } {
  const file = parse(source, filename);
  const roots: ts.Identifier[] = [];
  const previewImports: ts.ImportDeclaration[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text === moduleName) previewImports.push(statement);
    if (statement.moduleSpecifier.text === "react-dom/client") {
      const bindings = statement.importClause?.namedBindings;
      if (!statement.importClause?.isTypeOnly && bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements)
          if ((binding.propertyName ?? binding.name).text === "createRoot" && !binding.isTypeOnly) roots.push(binding.name);
    }
  }
  if (roots.length !== 1) unsupported("Import one createRoot from react-dom/client in the application entry.");
  const rootName = roots[0].text;
  const creations: ts.CallExpression[] = [];
  walk(file, node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === rootName) creations.push(node);
  });
  if (creations.length !== 1) unsupported("Use one unambiguous React createRoot call.");
  const creation = creations[0];
  let receiver: ts.Expression = creation;
  let declaration: ts.VariableDeclaration | undefined;
  if (ts.isVariableDeclaration(creation.parent) && creation.parent.initializer === creation && ts.isIdentifier(creation.parent.name)) {
    declaration = creation.parent;
    if (!ts.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ts.NodeFlags.Const)
      || !ts.isVariableStatement(declaration.parent.parent) || declaration.parent.parent.parent !== file)
      unsupported("React root must be a top-level const.");
    receiver = declaration.name as ts.Identifier;
  }
  const renders: ts.CallExpression[] = [];
  walk(file, node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "render") {
      const object = node.expression.expression;
      if (object === creation || (ts.isIdentifier(receiver) && ts.isIdentifier(object) && receiver.text === object.text)) renders.push(node);
    }
  });
  if (renders.length !== 1 || renders[0].arguments.length !== 1
    || !ts.isExpressionStatement(renders[0].parent) || renders[0].parent.parent !== file)
    unsupported("Use one top-level root.render with one render expression.");
  // Refuse shadowed/reused root bindings rather than guessing what runtime code invokes.
  for (const [name, allowed] of [[rootName, 2], ...(declaration ? [[(receiver as ts.Identifier).text, 2] as const] : [])] as const) {
    let uses = 0;
    walk(file, node => { if (ts.isIdentifier(node) && node.text === name
      && !(ts.isImportSpecifier(node.parent) && node.parent.propertyName === node)) uses++; });
    if (uses !== allowed) unsupported("React root bindings must not be shadowed, reassigned or reused.");
  }
  const argument = renders[0].arguments[0];
  if (previewImports.length) {
    const bindings = previewImports[0].importClause?.namedBindings;
    const binding = bindings && ts.isNamedImports(bindings) && bindings.elements.length === 1 ? bindings.elements[0] : undefined;
    if (previewImports.length !== 1 || !binding || binding.name.text !== alias
      || (binding.propertyName ?? binding.name).text !== "ProjectPreview" || binding.isTypeOnly
      || previewImports[0].importClause?.isTypeOnly || previewImports[0].importClause?.name
      || !ts.isJsxElement(argument) || argument.openingElement.tagName.getText(file) !== alias
      || argument.closingElement.tagName.getText(file) !== alias)
      throw fault("conflict", "Existing Flute import/wrapper differs from the generated integration.", filename);
    const attributes = argument.openingElement.attributes.properties;
    if (attributes.length !== 2
      || attributes[0].getText(file) !== 'projectId="' + projectId + '"'
      || attributes[1].getText(file).replace(/\s/g, "") !== "enabled={import.meta.env.DEV}")
      throw fault("conflict", "Flute project identity or development gate changed.", filename);
    let aliases = 0;
    walk(file, node => { if (ts.isIdentifier(node) && node.text === alias) aliases++; });
    if (aliases !== 3) throw fault("conflict", "Duplicate Flute integration.", filename);
    return { text: source, integrated: true };
  }
  let reserved = false;
  walk(file, node => { if (ts.isIdentifier(node) && node.text === alias) reserved = true; });
  if (reserved || source.includes(moduleName)) throw fault("conflict", "Entry already contains a conflicting Flute integration.", filename);
  const start = argument.getStart(file);
  const end = argument.getEnd();
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const prefix = 'import { ProjectPreview as ' + alias + ' } from "' + moduleName + '";' + newline;
  const wrapped = "<" + alias + ' projectId="' + projectId + '" enabled={import.meta.env.DEV}>{'
    + source.slice(start, end) + "}</" + alias + ">";
  const insertion = file.statements.find(ts.isImportDeclaration)!.getStart(file);
  if (insertion > start) unsupported("Place React imports before the root render call.");
  return { text: source.slice(0, insertion) + prefix + source.slice(insertion, start) + wrapped + source.slice(end), integrated: false };
}
