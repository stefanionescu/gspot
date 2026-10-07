import { toPosix } from '#cli/platform/paths.ts';
import { getTsconfig } from '#cli/parsers/tsconfig.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { TRAILING_STAR } from '#cli/config/repository/aliases.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';

function importTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (typeof target !== 'object' || target === null) return undefined;
    return Object.values(target as Record<string, unknown>).find((value) => typeof value === 'string');
}

function packageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const path = `${prefix}package.json`;
    const manifest = readPackageManifest(root, path);
    const imports = manifest?.imports === undefined ? [] : Object.entries(manifest.imports);
    for (const [pattern, target] of imports) {
        const found = importTarget(target);
        if (found === undefined) continue;
        if (!found.startsWith('./')) continue;
        const alias = found.slice('./'.length).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = `${prefix}${alias}`;
    }
    return aliases;
}

/**
 * Resolves package imports and TypeScript paths for one scope, with TypeScript paths taking precedence.
 * @param root the repository root.
 * @param scope the scope path, empty for the root.
 * @returns aliases relative to the repository root.
 */
export function aliasesFor(root: string, scope: string): Record<string, string> {
    const prefix = scope === '' ? '' : `${scope}/`;
    const aliases = packageAliases(root, prefix);
    const path = join(root, prefix, 'tsconfig.json');
    const config = getTsconfig(root, path);
    if (config === undefined) return aliases;
    const options = config.options;
    const paths = options.paths === undefined ? [] : Object.entries(options.paths);
    const inheritedBase = options['pathsBasePath'];
    const base = options.baseUrl ?? (typeof inheritedBase === 'string' ? inheritedBase : dirname(path));
    for (const [pattern, targets] of paths) {
        const target = targets[0];
        if (target === undefined) continue;
        const alias = toPosix(relative(root, resolve(base, target))).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = alias;
    }
    return aliases;
}
