import { carriedTool, reasonFor, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { asRaw, asStrings, asText } from '#cli/policy/adoption/source.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { posix } from 'node:path';
import { z } from 'zod';

const strings = z.array(z.string());

const COMMENT_MARK = /^(?:#|\/\/)\s?/u;

function commentAbove(lines: string[], index: number): string | undefined {
    const above: string[] = [];
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const line = lines[cursor]?.trim() ?? '';
        if (!line.startsWith('#') && !line.startsWith('//')) break;
        above.unshift(line.replace(COMMENT_MARK, ''));
    }
    const text = above.join(' ').trim();
    return text === '' ? undefined : text;
}

function isKeyLine(line: string, key: string): boolean {
    const trimmed = line.trim();
    const bare = trimmed.startsWith('"') ? trimmed.slice(1) : trimmed;
    if (!bare.startsWith(key)) return false;
    const after = bare.slice(key.length).trimStart();
    return after.startsWith('"') ? after.slice(1).trimStart().startsWith('=') : after.startsWith('=');
}

function carryTyposWords(lines: string[], words: TomlTable, path: string): { word: string; reason: string }[] {
    return Object.keys(words).map((word) => {
        const index = lines.findIndex((line) => isKeyLine(line, word));
        const comment = index === -1 ? undefined : commentAbove(lines, index);
        return { word, reason: comment ?? reasonFor(path) };
    });
}

function carryTypos(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    const text = source.text;
    const parsed = source.parsed;
    const defaults = asRaw(parsed['default']);
    // typos with no locale accepts British and American spellings alike, and the repository was written under that.
    const settings: TomlTable = { locale: asText(defaults?.['locale']) ?? 'en' };
    const words = carryTyposWords(text.split('\n'), asRaw(defaults?.['extend-words']) ?? {}, path);
    if (words.length > 0) settings['words'] = words;
    const excludes = asStrings(asRaw(parsed['files'])?.['extend-exclude']);
    const base = posix.dirname(path);
    const paths = excludes
        .filter((pattern) => pattern !== '' && !pattern.startsWith('#'))
        .map((pattern) => {
            if (base === '.') return pattern;
            const negated = pattern.startsWith('!');
            const bare = negated ? pattern.slice(1) : pattern;
            const directory = bare.endsWith('/');
            const selector = directory ? bare.slice(0, -1) : bare;
            const rooted = selector.startsWith('/') || selector.includes('/');
            const prefix = base.replaceAll(/[?*\[\]{}]/gu, String.raw`\$&`);
            return `${negated ? '!' : ''}${prefix}/${rooted ? '' : '**/'}${selector.replace(/^\//u, '')}${directory ? '/' : ''}`;
        });
    if (paths.length > 0) settings['exclude'] = [{ paths, reason: reasonFor(path) }];
    if (base === '.') Object.assign(carriedTool(lists, 'typos').settings, settings);
    else {
        const scope = lists.scopes.get(base) ?? { configurations: [], tools: {} };
        scope.configurations = [...new Set([...scope.configurations, 'spelling'])];
        scope.tools['typos'] = settings;
        lists.scopes.set(base, scope);
    }
}

export const typosImporter = {
    schema: z.strictObject({
        default: z
            .strictObject({
                locale: z
                    .string()
                    .refine(
                        (locale) => policySchema.safeParse({ version: 1, tools: { typos: { locale } } }).success,
                        'Use a supported typos locale.',
                    )
                    .optional(),
                'extend-words': z
                    .record(z.string(), z.string())
                    .refine(
                        (words) => Object.entries(words).every(([word, replacement]) => word === replacement),
                        'Spelling replacements require explicit conversion.',
                    )
                    .optional(),
            })
            .optional(),
        files: z.strictObject({ 'extend-exclude': strings.optional() }).optional(),
    }),
    carry: carryTypos,
};
