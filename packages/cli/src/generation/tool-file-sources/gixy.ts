import type { ScopeView } from '#cli/types/settings/values.ts';

/**
 * Write the gixy configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.rulesOff the disabled lint rule reader.
 *
 * @returns the generated configuration text.
 */
export function gixyToolFile({ rulesOff }: Pick<ScopeView, 'rulesOff'>): string {
    const off = rulesOff('nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}\n`;
}
