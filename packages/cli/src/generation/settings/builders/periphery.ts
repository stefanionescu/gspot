import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/settings/builders/periphery.ts';

/**
 * Build the Periphery file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Xcode project, schemes, and retained Periphery declarations as YAML.
 */
export function buildPeripheryFile(planned: PlannedToolFile): string {
    const project = getTable(planned.scope.settings, 'swift').xcode_project;
    const scheme = getTable(planned.scope.settings, 'swift').xcode_scheme;
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
