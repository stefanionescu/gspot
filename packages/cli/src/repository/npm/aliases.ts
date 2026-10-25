import { isTable } from '#cli/system/tables.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { PATHS_BASE_OPTION, LOCAL_PATH_PREFIX } from '#cli/config/repository/npm.ts';

function findImportTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    return isTable(target) ? Object.values(target).find((value) => typeof value === 'string') : undefined;
}

/**
Read the package.json imports of one project, which Node resolves without a compiler.

@param root the repository root.
@param prefix the project folder with a trailing slash, or empty for the root.
@returns the alias prefixes and their repository-relative folders.
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

@param repositoryRoot the root that alias paths start from.
@param scope the folder, empty for the root.
@param reads the run cache for compiler settings.
@returns aliases relative to the repository root.
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
        const alias = convertToPosixPath(relative(repositoryRoot, resolve(base, target)));
        aliases[pattern] = alias;
    }
    return aliases;
}
