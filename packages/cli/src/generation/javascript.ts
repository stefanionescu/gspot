import { toPosix } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { readPackageManifest } from '#cli/repository/packages.ts';
import { TRAILING_STAR } from '#cli/config/generation/generation.ts';

function importTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (typeof target !== 'object' || target === null) return undefined;
    return Object.values(target as Record<string, unknown>).find((value) => typeof value === 'string');
}

function packageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const files = openRoot(root);
    const path = `${prefix}package.json`;
    let imports: [string, unknown][];
    try {
        imports = files.stat(path) === undefined ? [] : Object.entries(readPackageManifest(root, path).imports ?? {});
    } finally {
        files.close();
    }
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
    const paths = Object.entries(options.paths ?? {});
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

// Inherit authored resolution and file selection. A default input glob belongs to the repository,
// not the generated configuration directory.
/**
 * The generated jsconfig: type-checks JavaScript with the scope's own resolution when it has one.
 * @param root the repository root
 * @param policy the repository policy
 * @param target the path of the generated file
 * @param scope the scope path, '' for the root
 * @returns the jsconfig contents
 */
export function javascriptConfiguration(
    root: string,
    policy: Policy,
    target: string,
    scope: string,
): Record<string, unknown> {
    const config = getTsconfig(root, join(root, scope, 'jsconfig.json'));
    const prefix = toPosix(relative(dirname(target), scope || '.')) + '/';
    const compilerOptions = { checkJs: true, allowJs: true, strict: true, noEmit: true };
    const configuration: Record<string, unknown> = { compilerOptions };
    if (config === undefined) {
        Object.assign(compilerOptions, {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            skipLibCheck: true,
            resolveJsonModule: true,
        });
        configuration['exclude'] = [
            '**/node_modules/**',
            '.gspot/**',
            '**/eslint.config.mjs',
            '**/eslint.config.js',
            '**/eslint.config.cjs',
            ...policy.declarations.flatMap((entry) => entry.paths),
        ].map((path) => `${prefix}${path}`);
    } else configuration['extends'] = `${prefix}jsconfig.json`;
    const raw: unknown = config?.raw;
    const listsSources = typeof raw === 'object' && raw !== null && ('files' in raw || 'include' in raw);
    if (!listsSources)
        configuration['include'] = ['js', 'mjs', 'cjs', 'jsx'].map((extension) => `${prefix}**/*.${extension}`);
    return configuration;
}
