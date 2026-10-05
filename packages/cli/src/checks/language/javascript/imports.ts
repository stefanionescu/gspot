import { memo } from '#cli/platform/memo.ts';
import type { Node, Tree } from 'web-tree-sitter';
import { extensionOf } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { modulePath, getCompilerOptions } from '#cli/repository/modules.ts';
import type { Edge, Importer, ImportIndex } from '#cli/types/checks/language/javascript.ts';

const IMPORT_MEMO = { create: () => new Map<string, Promise<ImportIndex>>() };

// Refuse incomplete tree-sitter parses and identify the first invalid location.
function assertParsed(tree: Tree, path: string): void {
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
function getNodeEdges(importer: Importer, node: Node): Edge[] {
    const { input, path, owned, options } = importer;
    const specifier = importedModule(node);
    if (specifier === undefined) return [];
    // The file the import names; none for a package, a missing file, or a file of another kind.
    const target = modulePath(input, path, specifier, options);
    if (target === undefined) return [];
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

async function readImportEdges(input: EngineInput, path: string, owned: Set<string>): Promise<Edge[]> {
    const text = readSource(input.root, path, input.reads).toString('utf8');
    const tree = await parseSource(path.endsWith('x') ? 'tsx' : 'typescript', text, input);
    try {
        assertParsed(tree, path);
        const importer: Importer = { input, path, owned, options: getCompilerOptions(input, path) };
        return tree.rootNode
            .descendantsOfType(['import_statement', 'export_statement', 'call_expression'])
            .flatMap((node) => getNodeEdges(importer, node));
    } finally {
        tree.delete();
    }
}

async function readImports(input: EngineInput, paths: string[]): Promise<ImportIndex> {
    const importers = new Map<string, Set<string>>();
    const owned = new Set(paths);
    const edges: ImportIndex['edges'] = [];
    for (const path of paths) {
        const imported = await readImportEdges(input, path, owned);
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
 * @returns source paths, their importing files, and each resolved value-import edge with its source location
 */
export async function getScopeImports(input: EngineInput): Promise<ImportIndex> {
    const scopes = memo(input.reads, IMPORT_MEMO);
    const children = input.scopeEntries
        .map((entry) => entry.path)
        .filter((path) => path !== input.scope && isInScope(path, input.scope));
    const extensions = new Set(extensionsTagged('javascript', 'typescript'));
    const paths = input.files
        .filter((file) => file.kind === 'source' && extensions.has(extensionOf(file.path)))
        .map((file) => file.path)
        .filter((path) => isInScope(path, input.scope) && children.every((child) => !isInScope(path, child)));
    const key = JSON.stringify([input.scope, paths]);
    const held = scopes.get(key);
    if (held !== undefined) return held;
    const index = readImports(input, paths);
    scopes.set(key, index);
    return index;
}
