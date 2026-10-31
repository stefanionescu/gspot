import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/configurations/language/swift.ts';

/**
Build periphery.yml: the Xcode project, schemes, and retained Periphery declarations as YAML.

@param planned the config file to build.
*/
export function buildPeripheryFile(planned: PlannedConfig): string {
    const project = getTable(planned.scope.settings, 'swift').xcode_project;
    const scheme = getTable(planned.scope.settings, 'swift').xcode_scheme;
    return stringifyYaml({
        ...(project !== undefined && { project }),
        ...(scheme !== undefined && { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
