import type { GeneratedFile } from '#cli/types/generation.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { Policy, MergedView } from '#cli/types/policy/policy.ts';
import { MAX_LINE, LONGER_THAN, STYLE_ASSETS } from '#cli/config/generation.ts';
import { GSPOT_STYLE, LENGTH_RULES, STYLES_DIRECTORY } from '#cli/config/kits.ts';

function renderedRule(stem: string, text: string, view: MergedView): string {
    const key = LENGTH_RULES[stem];
    const limit = key === undefined ? undefined : view.limit(key);
    if (limit === undefined) return text;
    return text
        .replace(MAX_LINE, () => `max: ${String(limit)}`)
        .replace(LONGER_THAN, () => `longer than ${String(limit)}`);
}
/**
 * The style and vocabulary files apply writes under .gspot/config/vale/styles.
 * @param policy the repository policy
 * @param view the root scope's merged view, for the docs limits
 * @returns the generated files
 */
export function styleFiles(policy: Policy, view: MergedView): GeneratedFile[] {
    const rules = listAssets(STYLE_ASSETS)
        .map((asset) => asset.slice(STYLE_ASSETS.length).replace(/\.yml$/u, ''))
        .map((stem): GeneratedFile => {
            const name = `${stem}.yml`;
            const asset = `${STYLE_ASSETS}${name}`;
            return {
                path: `${STYLES_DIRECTORY}/${GSPOT_STYLE}/${name}`,
                content:
                    renderedRule(stem, readAsset(asset), view) +
                    (stem === 'alt-text' && policy.level === 'all' ? "    - '!\\[(?:Image|Graphic|Picture) of'\n" : ''),
                readOnly: true,
                kind: 'config',
                kit: 'prose',
            };
        });
    const shipped = readAsset('packages/cli/kits/general/prose/vocabularies/gspot/accept.txt').trim().split(/\r?\n/u);
    const vocabulary = [...new Set([...shipped, ...policy.prose.vocabulary])].toSorted((a, b) => a.localeCompare(b));
    const base = `${STYLES_DIRECTORY}/config/vocabularies/${GSPOT_STYLE}`;
    return [
        ...rules,
        {
            path: `${base}/accept.txt`,
            content: `${vocabulary.join('\n')}\n`,
            readOnly: true,
            kind: 'config',
            kit: 'prose',
        },
    ];
}

/**
 * Bundled Vale style names shared by configuration and asset generation.
 * @returns the style names
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The template inputs read the style names through it; one owner keeps the asset listing.
export function styleNames(): string[] {
    return listAssets(STYLE_ASSETS).map((asset) => asset.slice(STYLE_ASSETS.length).replace(/\.yml$/u, ''));
}
