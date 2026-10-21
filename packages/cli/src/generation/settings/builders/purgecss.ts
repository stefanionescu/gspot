import { getTable } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';

import {
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/settings/builders/purgecss.ts';

/**
 * Build the PurgeCSS file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the JavaScript token extractor and safelist used by PurgeCSS.
 */
export function buildPurgecssFile(planned: PlannedToolFile): string {
    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...getTable(planned.selection.view, 'tools.purgecss').safelist.map((word) => JSON.stringify(word)),
    ];
    return `export const defaultExtractor = (content) =>
    (content.match(${String(PURGECSS_EXTRACTOR)}) ?? [])
        .map((token) => {
            let end = token.length;
            while (end > 0 && token[end - 1] === ${JSON.stringify(PURGECSS_TOKEN_END)}) end--;
            return token.slice(0, end);
        })
        .filter((token) => token !== '');

export const safelist = {
    standard: [
        ${standard.join(',\n        ')},
    ],
};`;
}
