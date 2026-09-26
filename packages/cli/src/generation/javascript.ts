import { toPosix } from '#cli/platform/paths.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { dirname, join, relative, resolve } from 'node:path';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';

const TRAILING_STAR = /\*$/u;

function importTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (typeof target !== 'object' || target === null) return undefined;
    return Object.values(target as Record<string, unknown>).find((value) => typeof value === 'string');
}

function packageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const files = openConfinedRoot(root);
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
        const alias = found.slice(2).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = `${prefix}${alias}`;
    }
    return aliases;
}

function tsconfigAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const path = join(root, prefix, 'tsconfig.json');
    const options = getTsconfig(root, path)?.options;
    if (options === undefined) return aliases;
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

// Whether an authored jsconfig names its own files or include globs.
function listsSources(raw: unknown): boolean {
    return typeof raw === 'object' && raw !== null && ('files' in raw || 'include' in raw);
}

/**
 * The import aliases a scope declares, from its package.json imports and its tsconfig paths.
 * @param root the repository root
 * @param scope the scope path, '' for the root
 * @returns alias to target path
 */
export function aliasesFor(root: string, scope: string): Record<string, string> {
    const prefix = scope === '' ? '' : `${scope}/`;
    return { ...packageAliases(root, prefix), ...tsconfigAliases(root, prefix) };
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
export function javascriptConfig(root: string, policy: Policy, target: string, scope: string): Record<string, unknown> {
    const config = getTsconfig(root, join(root, scope, 'jsconfig.json'));
    const prefix = toPosix(relative(dirname(target), scope || '.')) + '/';
    const defaults =
        config === undefined
            ? {
                  target: 'ES2022',
                  module: 'NodeNext',
                  moduleResolution: 'NodeNext',
                  skipLibCheck: true,
                  resolveJsonModule: true,
              }
            : {};
    return {
        ...(config === undefined ? {} : { extends: `${prefix}jsconfig.json` }),
        compilerOptions: { ...defaults, checkJs: true, allowJs: true, strict: true, noEmit: true },
        ...(listsSources(config?.raw)
            ? {}
            : {
                  include: ['js', 'mjs', 'cjs', 'jsx'].map((extension) => `${prefix}**/*.${extension}`),
              }),
        ...(config === undefined
            ? {
                  exclude: [
                      '**/node_modules/**',
                      '.gspot/**',
                      '**/eslint.config.mjs',
                      '**/eslint.config.js',
                      '**/eslint.config.cjs',
                      '**/dist/**',
                      '**/build/**',
                      '**/coverage/**',
                      '**/.build/**',
                      '**/DerivedData/**',
                      ...policy.declarations.flatMap((entry) => entry.paths),
                  ].map((path) => `${prefix}${path}`),
              }
            : {}),
    };
}
