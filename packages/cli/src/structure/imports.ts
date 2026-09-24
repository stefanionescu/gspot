import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { dirname, join, relative } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import { isInScope } from '#cli/configurations/claims.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { ImportIndex } from '#cli/types/structure.ts';

const SOURCE = /\.[cm]?[jt]sx?$/u;
const IMPORT_KINDS = new Set(['import-statement', 'require-call', 'dynamic-import']);
const cache = new WeakMap<object, Map<string, Promise<ImportIndex>>>();

function modulePath(path: string, directory: string): string | undefined {
    try {
        return Bun.resolveSync(path, directory);
    } catch (error) {
        // An uninstalled external package cannot be a tracked route in this scope.
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ERR_MODULE_NOT_FOUND' &&
            !path.startsWith('.') &&
            !path.startsWith('#')
        )
            return undefined;
        throw error;
    }
}

async function importedEdges(input: EngineInput, path: string, owned: Set<string>): Promise<ImportIndex['edges']> {
    const text = readSource(input.root, path, input.observations).toString('utf8');
    const tree = await parseSource(path.endsWith('x') ? 'tsx' : 'typescript', text, input);
    if (tree === null) throw new Error(`Cannot parse imports in ${path}.`);
    try {
        if (tree.rootNode.hasError) {
            const location = (tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode).startPosition;
            throw new Error(`Cannot parse imports in ${path}:${String(location.row + 1)}:${String(location.column + 1)}.`);
        }
        const scanner = new Bun.Transpiler({ loader: path.endsWith('x') ? 'tsx' : 'ts' });
        const edges: ImportIndex['edges'] = [];
        for (const node of tree.rootNode.descendantsOfType([
            'import_statement',
            'export_statement',
            'call_expression',
        ])) {
            const source = node.childForFieldName('source');
            const callee = node.childForFieldName('function');
            if (
                source === null &&
                (node.type !== 'call_expression' || !['import', 'require'].includes(callee?.text ?? ''))
            )
                continue;
            for (const entry of scanner.scanImports(node.text)) {
                if (!IMPORT_KINDS.has(entry.kind)) continue;
                const resolved = modulePath(entry.path, dirname(join(input.root, path)));
                if (resolved === undefined) continue;
                const target = toPosix(relative(input.root, resolved));
                if (!owned.has(target)) continue;
                edges.push({
                    from: path,
                    to: target,
                    source: entry.path,
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column + 1,
                });
            }
        }
        return edges;
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
    let scopes = cache.get(input.observations);
    if (scopes === undefined) {
        scopes = new Map();
        cache.set(input.observations, scopes);
    }
    const children = input.scopeEntries
        .map((entry) => entry.path)
        .filter((path) => path !== input.scope && isInScope(path, input.scope));
    const paths = input.files
        .filter((file) => file.nature === 'source' && SOURCE.test(file.path))
        .map((file) => file.path)
        .filter((path) => isInScope(path, input.scope) && children.every((child) => !isInScope(path, child)));
    const key = JSON.stringify([input.scope, paths]);
    const held = scopes.get(key);
    if (held !== undefined) return held;
    const index = readImports(input, paths);
    scopes.set(key, index);
    return index;
}
