import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/configurations/framework/site.ts';

/**
Build purgecss.mjs: the JavaScript token extractor and safelist used by PurgeCSS.

@param planned the config file with its scope, level, and target path.
@returns the JavaScript token extractor and safelist used by PurgeCSS.
*/
export function buildPurgecssFile(planned: PlannedConfigFile): string {
    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...getTable(planned.scope.settings, 'tools.purgecss').safelist.map((word) => JSON.stringify(word)),
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
