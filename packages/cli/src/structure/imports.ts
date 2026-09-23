import { readSource } from '#cli/repository/tracked.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { isInScope } from '#cli/presets/claims.ts';
import { dirname, join, relative } from 'node:path';
import type { ImportIndex } from '#cli/structure/types.ts';
import type { EngineInput } from '#cli/run/types.ts';

const SOURCE = /\.[cm]?[jt]sx?$/u;
const IMPORT_KINDS = new Set(['import-statement', 'require-call', 'dynamic-import']);
const cache = new WeakMap<object, Map<string, ImportIndex>>();

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

function importedPaths(root: string, path: string, owned: Set<string>): string[] {
    const full = join(root, path);
    const parser = new Bun.Transpiler({ loader: path.endsWith('x') ? 'tsx' : 'ts' });
    return parser
        .scanImports(readSource(root, path))
        .filter((entry) => IMPORT_KINDS.has(entry.kind))
        .map((entry) => modulePath(entry.path, dirname(full)))
        .filter((resolved) => resolved !== undefined)
        .map((resolved) => toPosix(relative(root, resolved)))
        .filter((target) => owned.has(target));
}

function readImports(input: EngineInput, paths: string[]): ImportIndex {
    const importers = new Map<string, Set<string>>();
    const owned = new Set(paths);
    for (const path of paths) {
        const targets = importedPaths(input.root, path, owned);
        for (const target of targets) {
            const users = importers.get(target) ?? new Set<string>();
            users.add(path);
            importers.set(target, users);
        }
    }
    return { paths, importers };
}

/**
 * Resolved JavaScript and TypeScript imports owned by one scope, shared for the session.
 * @param input the check and its repository session
 * @returns source paths and the files importing each path
 */
export function scopeImports(input: EngineInput): ImportIndex {
    let scopes = cache.get(input.runKey);
    if (scopes === undefined) {
        scopes = new Map();
        cache.set(input.runKey, scopes);
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
