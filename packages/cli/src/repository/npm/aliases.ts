import { isTable } from '#cli/system/tables.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { IMPORT_CONDITIONS, PATHS_BASE_OPTION, LOCAL_PATH_PREFIX } from '#cli/config/repository/npm.ts';

function findImportTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (!isTable(target)) return undefined;
    for (const [condition, value] of Object.entries(target)) {
        if (!IMPORT_CONDITIONS.has(condition)) continue;
        const found = findImportTarget(value);
        if (found !== undefined) return found;
    }
    return undefined;
}

/**
Read the package.json imports of one project, which Node resolves without a compiler.

@param root the repository root.
@param prefix the project folder with a trailing slash, or empty for the root.
*/
export function readPackageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const path = `${prefix}${PACKAGE_JSON}`;
    const packageJson = readPackageJson(root, path);
    const imports = packageJson?.imports === undefined ? [] : Object.entries(packageJson.imports);
    for (const [pattern, target] of imports) {
        const found = findImportTarget(target);
        if (found?.startsWith(LOCAL_PATH_PREFIX) !== true) continue;
        const alias = found.slice(LOCAL_PATH_PREFIX.length);
        aliases[pattern] = `${prefix}${alias}`;
    }
    return aliases;
}

/**
Resolve package imports and TypeScript paths for one scope. TypeScript paths win.

@param root the root that alias paths start from.
@param scopePath the folder, empty for the root.
@param cache the run cache for compiler settings.
@returns aliases relative to the repository root.
*/
export function readScopeAliases(root: string, scopePath: string, cache: RunCache): Record<string, string> {
    const prefix = joinScope(scopePath, '');
    const aliases = readPackageAliases(root, prefix);
    const path = join(root, prefix, TSCONFIG_FILE);
    const config = readTsconfig(root, path, cache);
    if (config === undefined) return aliases;
    const options = config.options;
    const paths = options.paths === undefined ? [] : Object.entries(options.paths);
    const inheritedBase = options[PATHS_BASE_OPTION];
    const base = options.baseUrl ?? (typeof inheritedBase === 'string' ? inheritedBase : dirname(path));
    for (const [pattern, targets] of paths) {
        const target = targets[0];
        if (target === undefined) continue;
        const alias = convertToPosixPath(relative(root, resolve(base, target)));
        aliases[pattern] = alias;
    }
    return aliases;
}
