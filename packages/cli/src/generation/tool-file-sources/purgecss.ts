import type { ScopeView } from '#cli/types/settings/values.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';

import {
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the purgecss configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.options the command options.
 *
 * @returns the generated configuration text.
 */
export function purgecssToolFile({ options }: Pick<ScopeView, 'options'>): string {
    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...options('tools.purgecss').safelist.map((word) => JSON.stringify(word, null, JSON_INDENT)),
    ];
    return `export const defaultExtractor = (content) => (content.match(${String(PURGECSS_EXTRACTOR)}) ?? []).map((token) => { let end = token.length; while (end > 0 && token[end - 1] === ${JSON.stringify(PURGECSS_TOKEN_END)}) end--; return token.slice(0, end); }).filter((token) => token !== '');\nexport const safelist = { standard: [${standard.join(', ')}] };\n`;
}
