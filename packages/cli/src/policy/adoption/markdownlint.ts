import { z } from 'zod';
import { extname, posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { carriedTool, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import { asRaw, observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';

const MARKDOWN_SOURCE = z
    .object({ extends: z.string().min(1).optional() })
    .catchall(z.union([z.boolean(), z.record(z.string(), z.json())]))
    .refine(
        (source) =>
            Object.keys(source).every(
                (key) => key === 'extends' || /^(?:default|MD\d{3}|[a-z]+(?:-[a-z]+)+)$/u.test(key),
            ),
        'Use Markdown rule names or a static inheritance path.',
    );

function carryMarkdownlint(source: CarrySource, path: string, lists: CarriedConfiguration, root: string): void {
    const visiting = new Set<string>();
    const inherited = new Set<string>();
    const resolve = (path: string, input: TomlTable): TomlTable => {
        if (visiting.has(path)) throw new Error(`${path}: Markdown configuration inheritance contains a cycle.`);
        visiting.add(path);
        const { extends: parent, ...rules } = MARKDOWN_SOURCE.parse(input);
        let defaults: TomlTable = {};
        if (parent !== undefined) {
            if ((!parent.startsWith('./') && !parent.startsWith('../')) || /[\\:]/u.test(parent))
                throw new Error(`${path}: inherited Markdown configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), parent));
            if (!['.json', '.jsonc', '.yaml', '.yml'].includes(extname(target)))
                throw new Error(`${path}: inherited Markdown configuration requires static JSON or YAML.`);
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            inherited.add(target);
            defaults = resolve(target, parseCarrySource(original, 'markdownlint-cli2', target).parsed);
        }
        visiting.delete(path);
        return { ...defaults, ...rules };
    };
    const rules = { default: true, ...resolve(path, asRaw(source.parsed['config']) ?? source.parsed) };
    const converted = parseToml(stringifyToml({ rules }));
    if (!isDeepStrictEqual(converted['rules'], rules))
        throw new Error(`${path}: Markdown rule options cannot be represented without loss in TOML.`);
    const base = posix.dirname(path);
    if (base === '.') carriedTool(lists, 'markdownlint').settings['rules'] = rules;
    else {
        const scope = lists.scopes.get(base) ?? { configurations: [], tools: {} };
        scope.configurations = [...new Set([...scope.configurations, 'markdown'])];
        scope.tools['markdownlint'] = { rules };
        lists.scopes.set(base, scope);
    }
    for (const parent of inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Markdown configuration retained; effective rules are represented in gspot configuration',
        });
}

export const markdownImporter = {
    schema: z.union([MARKDOWN_SOURCE, z.strictObject({ config: MARKDOWN_SOURCE })]),
    carry: carryMarkdownlint,
};
