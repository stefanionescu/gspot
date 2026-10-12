import { stringify } from 'yaml';
import { SPECTRAL_RECOMMENDED_OFF } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the spectral configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.isAll whether the all level applies.
 *
 * @returns the generated configuration text.
 */
export function spectralToolFile({ isAll }: { isAll: boolean }): string {
    return stringify({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    }).trimEnd();
}
