import { stringify } from 'yaml';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/swift.ts';

/**
 * Write the periphery configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function peripheryToolFile({ settings }: Pick<ScopeView, 'settings'>): string {
    const project = settings['xcode.project'];
    const scheme = settings['xcode.scheme'];
    return stringify({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
