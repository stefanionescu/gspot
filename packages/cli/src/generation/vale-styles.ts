import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { STYLES_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { Policy, ScopeView } from '#cli/types/policy/settings.ts';

import {
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
 * The style and vocabulary files apply writes under .gspot/config/vale/styles.
 * @param policy the repository policy.
 * @param view the root scope's merged view, for the docs limits.
 * @returns the generated files.
 */
export function styleFiles(policy: Policy, view: ScopeView): GeneratedFile[] {
    const rules = styleRules().map((stem): GeneratedFile => {
        const name = `${stem}.yml`;
        const asset = `${STYLE_ASSETS}${name}`;
        return {
            path: `${STYLES_DIRECTORY}/${GSPOT_STYLE}/${name}`,
            content:
                renderedRule(stem, readAsset(asset), view) +
                (stem === 'alt-text' && policy.level === 'all' ? "    - '!\\[(?:Image|Graphic|Picture) of'\n" : ''),
            readOnly: true,
            kind: 'config',
        };
    });
    const shipped = readAsset('configurations/general/prose/vocabularies/gspot/accept.txt').trim().split(/\r?\n/u);
    const vocabulary = [...new Set([...shipped, ...policy.prose.vocabulary])].toSorted((a, b) => a.localeCompare(b));
    const base = `${STYLES_DIRECTORY}/config/vocabularies/${GSPOT_STYLE}`;
    return [
        ...rules,
        {
            path: `${base}/accept.txt`,
            content: `${vocabulary.join('\n')}\n`,
            readOnly: true,
            kind: 'config',
        },
    ];
}

/**
 * Read the bundled gspot Vale rules for configuration and asset generation.
 * @returns the rule names.
 */
export function styleRules(): string[] {
    return listAssets(STYLE_ASSETS).map((asset) => asset.slice(STYLE_ASSETS.length).replace(/\.yml$/u, ''));
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
