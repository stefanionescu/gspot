import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { NamingDefaults } from '#cli/types/checks/general/naming.ts';
import { NAMING_DEFAULTS_FILE } from '#cli/config/configurations/naming.ts';
import { namingDefaultsSchema } from '#cli/schemas/configurations/naming.ts';

/**
Read the shipped naming choices.

@returns the shipped naming choices
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 6 calls in 5 files share it.
export function readNamingDefaults(): NamingDefaults {
    const contents = readFileSync(buildAssetPath(NAMING_DEFAULTS_FILE), 'utf8');
    return namingDefaultsSchema.parse(JSON.parse(contents));
}
