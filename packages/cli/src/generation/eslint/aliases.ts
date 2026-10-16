// Resolves package and TypeScript import aliases.
import { isRecord } from '#cli/system/values.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { TRAILING_STAR, LOCAL_PATH_PREFIX, PATHS_BASE_OPTION } from '#cli/config/repository/aliases.ts';

function findImportTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (!isRecord(target)) return undefined;
    return Object.values(target).find((value) => typeof value === 'string');
}

function readPackageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const path = `${prefix}package.json`;
    const packageJson = readPackageJson(root, path);
    const imports = packageJson?.imports === undefined ? [] : Object.entries(packageJson.imports);
    for (const [pattern, target] of imports) {
        const found = findImportTarget(target);
        if (found === undefined) continue;
        if (!found.startsWith(LOCAL_PATH_PREFIX)) continue;
        const alias = found.slice(LOCAL_PATH_PREFIX.length).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = `${prefix}${alias}`;
    }
    return aliases;
}

/**
 * Resolves package imports and TypeScript paths for one scope, with TypeScript paths taking precedence.
 * @param repositoryRoot the boundary for resolving compiler paths and expressing alias targets.
 * @param scope the scope path, empty for the root.
 * @param reads the run-owned compiler configuration cache.
 * @returns aliases relative to the repository root.
 */
export function readScopeAliases(repositoryRoot: string, scope: string, reads: ReadCache): Record<string, string> {
    const prefix = joinScope(scope, '');
    const aliases = readPackageAliases(repositoryRoot, prefix);
    const path = join(repositoryRoot, prefix, TSCONFIG_FILE);
    const config = readTsconfig(repositoryRoot, path, reads);
    if (config === undefined) return aliases;
    const options = config.options;
    const paths = options.paths === undefined ? [] : Object.entries(options.paths);
    const inheritedBase = options[PATHS_BASE_OPTION];
    const base = options.baseUrl ?? (typeof inheritedBase === 'string' ? inheritedBase : dirname(path));
    for (const [pattern, targets] of paths) {
        const target = targets[0];
        if (target === undefined) continue;
        const alias = convertToPosixPath(relative(repositoryRoot, resolve(base, target))).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = alias;
    }
    return aliases;
}
