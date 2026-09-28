import { z } from 'zod';
import { posix, extname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { adoptedTool, adoptedScope } from '#cli/policy/adoption/results.ts';
import type { AdoptionResult, ConfigurationSource } from '#cli/types/policy/adoption.ts';
import { asRaw, observeConfiguration, parseConfigurationSource } from '#cli/policy/adoption/source.ts';

const MARKDOWN_SOURCE = z
    .object({ extends: z.string().min(1).optional() })
    .catchall(z.union([z.boolean(), z.record(z.string(), z.json())]))
    .refine(
        (source) => Object.keys(source).every((key) => key === 'extends' || isMarkdownlintKey(key)),
        'Use Markdown rule names or a static inheritance path.',
    );

function carryMarkdownlint(source: ConfigurationSource, path: string, lists: AdoptionResult, root: string): void {
    const visiting = new Set<string>();
    const inherited = new Set<string>();
    const inheritedRules = (path: string, input: TomlTable): TomlTable => {
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
            defaults = inheritedRules(target, parseConfigurationSource(original, 'markdownlint-cli2', target).parsed);
        }
        visiting.delete(path);
        return { ...defaults, ...rules };
    };
    const rules = { default: true, ...inheritedRules(path, asRaw(source.parsed['config']) ?? source.parsed) };
    const converted = parseToml(stringifyToml({ rules }));
    if (!isDeepStrictEqual(converted['rules'], rules))
        throw new Error(`${path}: Markdown rule options cannot be represented without loss in TOML.`);
    const base = posix.dirname(path);
    if (base === '.') adoptedTool(lists, 'markdownlint').settings['rules'] = rules;
    else {
        const scope = adoptedScope(lists, base, 'markdown');
        scope.tools['markdownlint'] = { rules };
    }
    for (const parent of inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Markdown configuration retained; effective rules are represented in gspot configuration',
        });
}

// A markdownlint key: default, a rule identity such as MD013, or a hyphenated alias such as line-length.
function isMarkdownlintKey(key: string): boolean {
    if (key === 'default' || /^MD\d{3}$/u.test(key)) return true;
    const words = key.split('-');
    return words.length > 1 && words.every((word) => /^[a-z]+$/u.test(word));
}

export const markdownImporter = {
    schema: z.union([MARKDOWN_SOURCE, z.strictObject({ config: MARKDOWN_SOURCE })]),
    keep: carryMarkdownlint,
};
