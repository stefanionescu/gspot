import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { STYLES_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { Policy, ScopeView } from '#cli/types/policy/settings.ts';

import {
    WORDS,
    MAX_LINE,
    GSPOT_STYLE,
    LONGER_THAN,
    LENGTH_RULES,
    STYLE_ASSETS,
    PROSE_GRAMMARS,
} from '#cli/config/generation/prose.ts';

function renderedRule(stem: string, text: string, view: ScopeView): string {
    const key = LENGTH_RULES[stem];
    const limit = key === undefined ? undefined : view.limit(key);
    if (limit === undefined) return text;
    return text
        .replace(MAX_LINE, () => `max: ${String(limit)}`)
        .replace(LONGER_THAN, () => `longer than ${String(limit)}`);
}
/**
 * The style and accepted-word files apply writes under the Vale styles folder.
 * @param policy the repository policy.
 * @param view the root scope's merged view, for the docs limits.
 * @returns the generated files.
 */
export function styleFiles(policy: Policy, view: ScopeView): GeneratedFile[] {
    const rules = styleRules().map((stem): GeneratedFile => {
        const name = `${stem}.yml`;
        const asset = `${STYLE_ASSETS}${name}.eta`;
        return {
            path: `${STYLES_DIRECTORY}/${GSPOT_STYLE}/${name}`,
            content:
                renderedRule(stem, readAsset(asset), view) +
                (stem === 'alt-text' && policy.level === 'all'
                    ? readAsset('configurations/general/prose/alt-text-all.txt')
                    : ''),
            kind: 'tool_file',
        };
    });
    const shipped = readAsset(`configurations/general/prose/vocabularies/${GSPOT_STYLE}/accept.txt.eta`)
        .trim()
        .split(/\r?\n/u);
    const authored = Object.keys(policy.words);
    const words = [...new Set([...shipped, ...authored])].toSorted((a, b) => a.localeCompare(b));
    const base = `${STYLES_DIRECTORY}/config/vocabularies/${WORDS}`;
    return [
        ...rules,
        {
            path: `${base}/accept.txt`,
            content: `${words.join('\n')}\n`,
            kind: 'tool_file',
        },
    ];
}

/**
 * Read the bundled gspot Vale rules for configuration and asset generation.
 * @returns the rule names.
 */
export function styleRules(): string[] {
    return listAssets(STYLE_ASSETS).map((asset) => asset.slice(STYLE_ASSETS.length).replace(/\.yml\.eta$/u, ''));
}

/**
 * Derives the Vale format mappings from the declared source grammars.
 * @returns the extension and format pairs used by the Vale configuration.
 */
export function proseFormats(): [string, string][] {
    return Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
        grammar.format === undefined ? [] : [[extension.slice(1), grammar.format]],
    );
}
