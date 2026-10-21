import { readAsset } from '#cli/system/assets.ts';
import type { NamingDefaults } from '#cli/types/checks/naming.ts';
import { NAMING_DEFAULTS_FILE } from '#cli/config/checks/naming.ts';
import { namingDefaultsSchema } from '#cli/schemas/configurations/naming.ts';

let NAMING_DEFAULTS: NamingDefaults | undefined;

function readShippedNamingDefaults(): NamingDefaults {
    return namingDefaultsSchema.parse(JSON.parse(readAsset(NAMING_DEFAULTS_FILE)));
}

/**
 * Read the shipped naming settings once per process.
 *
 * @returns the shipped naming choices
 */
export function readNamingDefaults(): NamingDefaults {
    NAMING_DEFAULTS ??= readShippedNamingDefaults();
    return NAMING_DEFAULTS;
}
