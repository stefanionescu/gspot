import ts from 'typescript';
import type { Node } from 'web-tree-sitter';
import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import { readSource } from '#cli/repository/sources.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { SOURCE } from '#cli/config/checks/language/javascript.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import type { Edge, EdgeSource, ImportIndex } from '#cli/types/checks/language/javascript.ts';

const cache = new WeakMap<object, Map<string, Promise<ImportIndex>>>();
const projects = new WeakMap<object, Map<string, ts.CompilerOptions>>();

// The resolution settings of the tsconfig.json nearest a folder, which carry the path aliases imports use.
function projectOptions(input: EngineInput, directory: string): ts.CompilerOptions {
    const configuration = ts.findConfigFile(directory, (path) => ts.sys.fileExists(path)) ?? '';
    let held = projects.get(input.reads);
    if (held === undefined) {
        held = new Map();
        projects.set(input.reads, held);
    }
    let options = held.get(configuration);
    if (options === undefined) {
        const parsed =
            configuration === ''
                ? undefined
                : ts.getParsedCommandLineOfConfigFile(
                      configuration,
                      {},
                      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
                  );
        options = {
            ...parsed?.options,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            allowJs: true,
            resolveJsonModule: true,
        };
        held.set(configuration, options);
    }
    return options;
}

// Refuse incomplete tree-sitter parses and identify the first invalid location.
function assertParsed(tree: NonNullable<Awaited<ReturnType<typeof parseSource>>>, path: string): void {
    if (!tree.rootNode.hasError) return;
    const location = (tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode).startPosition;
    throw new Error(`Cannot parse imports in ${path}:${String(location.row + 1)}:${String(location.column + 1)}.`);
}

// The named specifiers of an import or export, when braces hold everything it brings in.
function namedSpecifiers(node: Node): Node[] {
    const clause = node.namedChildren.find((child) => child.type === 'import_clause' || child.type === 'export_clause');
    if (clause?.type === 'export_clause') return clause.namedChildren;
    const only = clause?.namedChildren.length === 1 ? clause.namedChildren[0] : undefined;
    return only?.type === 'named_imports' ? only.namedChildren : [];
}

// Whether an import or export carries only types: marked as a whole, or in each of its named specifiers.
function isTypeOnly(node: Node): boolean {
    if (node.children.some((child) => child.type === 'type')) return true;
    const specifiers = namedSpecifiers(node);
    return (
        specifiers.length > 0 &&
        specifiers.every((specifier) => specifier.children.some((child) => child.type === 'type'))
    );
}

// The module a call to import() or require() names with a string.
function calledModule(node: Node): string | undefined {
    const callee = node.childForFieldName('function')?.text;
    if (callee !== 'import' && callee !== 'require') return undefined;
    const argument = node.childForFieldName('arguments')?.namedChildren[0];
    return argument?.type === 'string' ? stringText(argument) : undefined;
}

// The module an importing node names: the source of an import or export, or the first argument of import() or
// require(). A type-only import or export names none, because it leaves no edge at run time.
function importedModule(node: Node): string | undefined {
    if (isTypeOnly(node)) return undefined;
    const source = node.childForFieldName('source');
    if (source !== null) return stringText(source);
    return node.type === 'call_expression' ? calledModule(node) : undefined;
}

// The text of a string literal without its quotes.
function stringText(node: Node): string | undefined {
    const text = node.namedChildren.find((child) => child.type === 'string_fragment')?.text;
    return text === undefined || text === '' ? undefined : text;
}

// The edge one importing node adds, when its module resolves to a tracked file of the scope.
function nodeEdges(source: EdgeSource, node: Node): Edge[] {
    const { input, path, owned } = source;
    const specifier = importedModule(node);
    if (specifier === undefined) return [];
    // The file the import names; none for a package, a missing file, or a file of another kind.
    const file = join(input.root, path);
    const resolved = ts.resolveModuleName(specifier, file, projectOptions(input, dirname(file)), ts.sys).resolvedModule
        ?.resolvedFileName;
    if (resolved === undefined) return [];
    const target = toPosix(relative(input.root, resolved));
    if (!owned.has(target)) return [];
    return [
        {
            from: path,
            to: target,
            source: specifier,
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
        },
    ];
}

async function importedEdges(input: EngineInput, path: string, owned: Set<string>): Promise<Edge[]> {
    const text = readSource(input.root, path, input.reads).toString('utf8');
    const tree = await parseSource(path.endsWith('x') ? 'tsx' : 'typescript', text, input);
    if (tree === null) throw new Error(`Cannot parse imports in ${path}.`);
    try {
        assertParsed(tree, path);
        const source: EdgeSource = { input, path, owned };
        return tree.rootNode
            .descendantsOfType(['import_statement', 'export_statement', 'call_expression'])
            .flatMap((node) => nodeEdges(source, node));
    } finally {
        tree.delete();
    }
}

async function readImports(input: EngineInput, paths: string[]): Promise<ImportIndex> {
    const importers = new Map<string, Set<string>>();
    const owned = new Set(paths);
    const edges: ImportIndex['edges'] = [];
    for (const path of paths) {
        const imported = await importedEdges(input, path, owned);
        edges.push(...imported);
        for (const { to } of imported) {
            const users = importers.get(to) ?? new Set<string>();
            users.add(path);
            importers.set(to, users);
        }
    }
    return { paths, importers, edges };
}

/**
 * Resolved JavaScript and TypeScript imports owned by one scope, shared for the session.
 * @param input the check and its repository session
 * @returns source paths and the files importing each path
 */
export async function scopeImports(input: EngineInput): Promise<ImportIndex> {
    let scopes = cache.get(input.reads);
    if (scopes === undefined) {
        scopes = new Map();
        cache.set(input.reads, scopes);
    }
    const children = input.scopeEntries
        .map((entry) => entry.path)
        .filter((path) => path !== input.scope && isInScope(path, input.scope));
    const paths = input.files
        .filter((file) => file.kind === 'source' && SOURCE.test(file.path))
        .map((file) => file.path)
        .filter((path) => isInScope(path, input.scope) && children.every((child) => !isInScope(path, child)));
    const key = JSON.stringify([input.scope, paths]);
    const held = scopes.get(key);
    if (held !== undefined) return held;
    const index = readImports(input, paths);
    scopes.set(key, index);
    return index;
}
