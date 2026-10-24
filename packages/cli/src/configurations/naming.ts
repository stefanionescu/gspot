import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { NamingDefaults } from '#cli/types/checks/general/naming.ts';
import { NAMING_DEFAULTS_FILE } from '#cli/config/configurations/naming.ts';
import { namingDefaultsSchema } from '#cli/schemas/configurations/naming.ts';

let NAMING_DEFAULTS: NamingDefaults | undefined;

/**
Read the shipped naming settings once per process.

@returns the shipped naming choices
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 6 calls in 5 files share it.
export function readNamingDefaults(): NamingDefaults {
    NAMING_DEFAULTS ??= namingDefaultsSchema.parse(
        JSON.parse(readFileSync(buildAssetPath(NAMING_DEFAULTS_FILE), 'utf8')),
    );
    return NAMING_DEFAULTS;
}
