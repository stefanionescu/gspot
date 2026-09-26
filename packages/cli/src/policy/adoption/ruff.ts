// Carrying a Ruff configuration into the policy: its ignored rules, per-file ignores, and inherited configuration.
import { z } from 'zod';
import { posix } from 'node:path';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { disabledFromList } from '#cli/policy/adoption/disabled.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { asRaw, asStrings, observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';
import { carriedTool, reasonFor, type CarriedConfiguration, type CarryPush } from '#cli/policy/adoption/results.ts';

type RuffLint = z.infer<typeof RUFF_LINT>;
type PerFile = Record<string, string[]>;
type Inheritance = {
    root: string;
    lists: CarriedConfiguration;
    base: string;
    visiting: Set<string>;
    inherited: Set<string>;
};

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

const ABSOLUTE_OR_ESCAPED = /[\\:]/u;
const GLOB_MAGIC = /[*?{[!]/u;
const UNSAFE_EXTEND = /[\\:$~]/u;

// Refuses a per-file selector the policy cannot spell: absolute, escaped, climbing, or negated below the root.
function assertConvertiblePerFile(glob: string, base: string, path: string): void {
    const isUnsafe = glob.startsWith('/') || ABSOLUTE_OR_ESCAPED.test(glob) || glob.split('/').includes('..');
    if (isUnsafe || (base !== '.' && glob.startsWith('!')))
        throw new Error(`${path}: per-file selector ${JSON.stringify(glob)} requires explicit conversion.`);
}

// A per-file selector as the policy spells it: anchored under the configuration's folder, basenames matched anywhere.
function perFilePattern(glob: string, base: string, path: string): string {
    assertConvertiblePerFile(glob, base, path);
    const negative = glob.startsWith('!');
    const pattern = negative ? glob.slice(1) : glob;
    const relative = pattern.includes('/') ? pattern : `**/${pattern}`;
    const folder = base === '.' ? '' : `${base}/`;
    return `${negative ? '!' : ''}${folder}${relative}`;
}

// Records the rules a Ruff lint table turns off, everywhere and per file.
function disabledRuff(parsed: TomlTable, push: CarryPush, path: string): void {
    const lint = asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
    const base = posix.dirname(path);
    const entries = ['per-file-ignores', 'extend-per-file-ignores'].flatMap((key) =>
        Object.entries(asRaw(lint[key]) ?? {}),
    );
    // Every selector is converted before any rule is recorded, so an unconvertible one imports nothing.
    const perFile = entries.map(([glob, codes]) => ({
        pattern: perFilePattern(glob, base, path),
        codes: asStrings(codes),
    }));
    disabledFromList(lint, 'ignore', push);
    disabledFromList(lint, 'extend-ignore', push);
    for (const { pattern, codes } of perFile) for (const code of codes) push(code, [pattern]);
}

// Adds rules under a pattern, keeping each rule once.
function addRules(result: PerFile, pattern: string, rules: string[]): void {
    result[pattern] = [...new Set([...(result[pattern] ?? []), ...rules])];
}

// Whether an inherited selector's fixed prefix reaches the folder of the adopting configuration.
function reachesBase(target: string, base: string): boolean {
    const parts = target.split('/');
    const magic = parts.findIndex((part) => GLOB_MAGIC.test(part));
    const fixed = (magic === -1 ? parts : parts.slice(0, magic)).join('/');
    return fixed === '' || fixed === base || base.startsWith(`${fixed}/`);
}

// The repository path an inherited per-file selector names, which must stay inside the repository.
function inheritedTarget(owner: string, pattern: string): string {
    if (pattern.startsWith('!') || pattern.startsWith('/') || ABSOLUTE_OR_ESCAPED.test(pattern))
        throw new Error(
            `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit conversion.`,
        );
    const target = posix.normalize(posix.join(posix.dirname(owner), pattern));
    if (target === '..' || target.startsWith('../'))
        throw new Error(`${owner}: inherited per-file selector escapes the repository.`);
    return target;
}

// An inherited per-file selector rebased onto the adopting configuration's folder, or undefined when it misses it.
function inheritedPattern(owner: string, pattern: string, base: string): string | undefined {
    const target = inheritedTarget(owner, pattern);
    if (base === '.') return target;
    if (target.startsWith(`${base}/`)) return target.slice(base.length + 1);
    if (!reachesBase(target, base)) return undefined;
    throw new Error(
        `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit scope conversion.`,
    );
}

// The per-file table of a configuration as seen from the adopting one: own selectors kept, inherited ones rebased.
function scopedPatterns(owner: string, path: string, base: string, table: PerFile | undefined): PerFile {
    const result: PerFile = {};
    for (const [pattern, rules] of Object.entries(table ?? {})) {
        if (owner === path || !pattern.includes('/')) {
            result[pattern] = rules;
            continue;
        }
        const scoped = inheritedPattern(owner, pattern, base);
        if (scoped !== undefined) addRules(result, scoped, rules);
    }
    return result;
}

// The configuration a Ruff file extends, observed and parsed, with its table selected inside pyproject.toml.
function extendedSource(inheritance: Inheritance, path: string, from: string): { target: string; source: CarrySource } {
    if (from.startsWith('/') || UNSAFE_EXTEND.test(from))
        throw new Error(`${path}: inherited Ruff configuration must use a repository-relative path.`);
    const target = posix.normalize(posix.join(posix.dirname(path), from));
    const original = inheritance.lists.observed.get(target) ?? observeConfiguration(inheritance.root, target).original;
    inheritance.lists.observed.set(target, original);
    inheritance.inherited.add(target);
    const selector = posix.basename(target) === 'pyproject.toml' ? { table: 'tool.ruff' } : undefined;
    return { target, source: parseCarrySource(original, 'ruff', target, selector) };
}

// The per-file tables of a parent and a child merged, each rule once per pattern.
function mergedPerFile(tables: (PerFile | undefined)[]): PerFile {
    const merged: PerFile = {};
    for (const table of tables)
        for (const [pattern, rules] of Object.entries(table ?? {})) addRules(merged, pattern, rules);
    return merged;
}

// The per-file ignores in force: the configuration's own, rebased, or the ones it inherits.
function perFileIgnores(
    parent: RuffLint,
    own: PerFile | undefined,
    path: string,
    adopting: string,
    base: string,
): PerFile {
    if (own === undefined) return parent['per-file-ignores'] ?? {};
    return scopedPatterns(path, adopting, base, own);
}

// The lint table the configuration extends, resolved, or an empty one when it extends nothing.
function parentLint(inheritance: Inheritance, path: string, extend: string | undefined, adopting: string): RuffLint {
    if (extend === undefined) return {};
    const extended = extendedSource(inheritance, path, extend);
    return resolveLint(inheritance, extended.target, extended.source, adopting);
}

// The effective lint table of a configuration: its own settings over the ones it extends.
function resolveLint(inheritance: Inheritance, path: string, source: CarrySource, adopting: string): RuffLint {
    const { visiting, base } = inheritance;
    if (visiting.has(path)) throw new Error(`${path}: Ruff configuration inheritance contains a cycle.`);
    visiting.add(path);
    const configuration = RUFF_SOURCE.parse(source.parsed);
    const lint = 'lint' in configuration ? configuration.lint : configuration;
    const parent = parentLint(inheritance, path, configuration.extend, adopting);
    visiting.delete(path);
    return {
        ignore: [...(parent.ignore ?? []), ...(lint.ignore ?? []), ...(lint['extend-ignore'] ?? [])],
        'per-file-ignores': perFileIgnores(parent, lint['per-file-ignores'], path, adopting, base),
        'extend-per-file-ignores': mergedPerFile([
            parent['extend-per-file-ignores'],
            scopedPatterns(path, adopting, base, lint['extend-per-file-ignores']),
        ]),
    };
}

function carryRuff(source: CarrySource, path: string, lists: CarriedConfiguration, root: string, check?: string): void {
    const base = posix.dirname(path);
    const inheritance: Inheritance = { root, lists, base, visiting: new Set(), inherited: new Set() };
    const lint = resolveLint(inheritance, path, source, path);
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
    for (const parent of inheritance.inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Ruff configuration retained; effective exclusions are represented in gspot configuration',
        });
}

export const ruffImporter = { schema: RUFF_SOURCE, carry: carryRuff };
