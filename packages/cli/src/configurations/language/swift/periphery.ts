import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import { PERIPHERY_RETAIN } from '#cli/config/configurations/swift.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build periphery.yml: the Xcode project, schemes, and retained Periphery declarations as YAML.

@param planned the config file to build.
*/
function buildPeripheryFile(planned: PlannedConfig): string {
    const project = getTable(planned.scope.settings, 'swift').xcode_project;
    const scheme = getTable(planned.scope.settings, 'swift').xcode_scheme;
    return stringifyYaml({
        ...(project !== undefined && { project }),
        ...(scheme !== undefined && { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}

export const PERIPHERY_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'swift/periphery.yml': buildPeripheryFile,
};
