import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/config-files/builders/periphery.ts';

/**
 * Build periphery.yml: the Xcode project, schemes, and retained Periphery declarations as YAML.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Xcode project, schemes, and retained Periphery declarations as YAML.
 */
export function buildPeripheryFile(planned: PlannedConfigFile): string {
    const project = getTable(planned.scope.settings, 'swift').xcode_project;
    const scheme = getTable(planned.scope.settings, 'swift').xcode_scheme;
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
