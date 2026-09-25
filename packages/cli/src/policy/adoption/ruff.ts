import { disabledFromList } from '#cli/policy/adoption/disabled.ts';
import { carriedTool, reasonFor, type CarriedConfiguration, type CarryPush } from '#cli/policy/adoption/results.ts';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { asRaw, asStrings, observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { posix } from 'node:path';
import { z } from 'zod';

const RUFF_LINT = z.strictObject({
    ignore: z.array(z.string()).optional(),
    'extend-ignore': z.array(z.string()).optional(),
    'per-file-ignores': z.record(z.string(), z.array(z.string())).optional(),
    'extend-per-file-ignores': z.record(z.string(), z.array(z.string())).optional(),
});

const RUFF_SOURCE = z.union([
    RUFF_LINT.extend({ extend: z.string().min(1).optional() }),
    z.strictObject({ lint: RUFF_LINT, extend: z.string().min(1).optional() }),
]);

function disabledRuff(parsed: TomlTable, push: CarryPush, path: string): void {
    const lint = asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
    const base = posix.dirname(path);
    const entries = ['per-file-ignores', 'extend-per-file-ignores'].flatMap((key) =>
        Object.entries(asRaw(lint[key]) ?? {}),
    );
    const perFile = entries.map(([glob, codes]) => {
        if (
            glob.startsWith('/') ||
            /[\\:]/u.test(glob) ||
            glob.split('/').includes('..') ||
            (base !== '.' && glob.startsWith('!'))
        )
            throw new Error(`${path}: per-file selector ${JSON.stringify(glob)} requires explicit conversion.`);
        const negative = glob.startsWith('!');
        const pattern = negative ? glob.slice(1) : glob;
        const relative = pattern.includes('/') ? pattern : `**/${pattern}`;
        return {
            pattern: `${negative ? '!' : ''}${base === '.' ? '' : `${base}/`}${relative}`,
            codes: asStrings(codes),
        };
    });
    disabledFromList(lint, 'ignore', push);
    disabledFromList(lint, 'extend-ignore', push);
    for (const { pattern, codes } of perFile) for (const code of codes) push(code, [pattern]);
}

function carryRuff(source: CarrySource, path: string, lists: CarriedConfiguration, root: string, check?: string): void {
    const visiting = new Set<string>();
    const inherited = new Set<string>();
    const base = posix.dirname(path);
    const scopedPatterns = (owner: string, table: Record<string, string[]> | undefined): Record<string, string[]> => {
        const result: Record<string, string[]> = {};
        for (const [pattern, rules] of Object.entries(table ?? {})) {
            if (owner === path || !pattern.includes('/')) {
                result[pattern] = rules;
                continue;
            }
            if (pattern.startsWith('!') || pattern.startsWith('/') || /[\\:]/u.test(pattern))
                throw new Error(
                    `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit conversion.`,
                );
            const target = posix.normalize(posix.join(posix.dirname(owner), pattern));
            if (target === '..' || target.startsWith('../'))
                throw new Error(`${owner}: inherited per-file selector escapes the repository.`);
            if (base === '.' || target.startsWith(`${base}/`)) {
                const scoped = base === '.' ? target : target.slice(base.length + 1);
                result[scoped] = [...new Set([...(result[scoped] ?? []), ...rules])];
                continue;
            }
            const parts = target.split('/');
            const magic = parts.findIndex((part) => /[*?{[!]/u.test(part));
            const fixed = (magic === -1 ? parts : parts.slice(0, magic)).join('/');
            if (fixed !== '' && !base.startsWith(`${fixed}/`) && fixed !== base) continue;
            throw new Error(
                `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit scope conversion.`,
            );
        }
        return result;
    };
    const resolve = (path: string, source: CarrySource): z.infer<typeof RUFF_LINT> => {
        if (visiting.has(path)) throw new Error(`${path}: Ruff configuration inheritance contains a cycle.`);
        visiting.add(path);
        const configuration = RUFF_SOURCE.parse(source.parsed);
        const lint = 'lint' in configuration ? configuration.lint : configuration;
        let parent: z.infer<typeof RUFF_LINT> = {};
        if (configuration.extend !== undefined) {
            const from = configuration.extend;
            if (from.startsWith('/') || /[\\:$~]/u.test(from))
                throw new Error(`${path}: inherited Ruff configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), from));
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            inherited.add(target);
            parent = resolve(
                target,
                parseCarrySource(
                    original,
                    'ruff',
                    target,
                    posix.basename(target) === 'pyproject.toml' ? { table: 'tool.ruff' } : undefined,
                ),
            );
        }
        const extended: Record<string, string[]> = {};
        for (const table of [parent['extend-per-file-ignores'], scopedPatterns(path, lint['extend-per-file-ignores'])])
            for (const [pattern, rules] of Object.entries(table ?? {}))
                extended[pattern] = [...new Set([...(extended[pattern] ?? []), ...rules])];
        visiting.delete(path);
        return {
            ignore: [...(parent.ignore ?? []), ...(lint.ignore ?? []), ...(lint['extend-ignore'] ?? [])],
            'per-file-ignores':
                lint['per-file-ignores'] === undefined
                    ? (parent['per-file-ignores'] ?? {})
                    : scopedPatterns(path, lint['per-file-ignores']),
            'extend-per-file-ignores': extended,
        };
    };
    const lint = resolve(path, source);
    if (check === undefined) throw new Error(`No complete ruff configuration importer is available for ${path}.`);
    disabledRuff(
        { lint },
        (rule, paths) => {
            const selected = paths ?? (base === '.' ? undefined : [`${base}/**`]);
            carriedTool(lists, 'ruff').ignores.push({
                check,
                rule,
                reason: reasonFor(path),
                ...(selected ? { paths: selected } : {}),
            });
        },
        path,
    );
    for (const parent of inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Ruff configuration retained; effective exclusions are represented in gspot configuration',
        });
}

export const ruffImporter = { schema: RUFF_SOURCE, carry: carryRuff };
