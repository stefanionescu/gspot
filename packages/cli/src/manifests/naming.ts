import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { NamingDefaults } from '#cli/types/manifests.ts';
import { NAMING_DEFAULTS_FILE } from '#cli/config/manifests/naming.ts';
import { namingDefaultsSchema } from '#cli/schemas/manifests/naming.ts';

let namingDefaults: NamingDefaults | undefined;

/**
Read the shipped naming choices once per process.
*/
export function readNamingDefaults(): NamingDefaults {
    if (namingDefaults !== undefined) return namingDefaults;
    const contents = readFileSync(buildAssetPath(NAMING_DEFAULTS_FILE), 'utf8');
    namingDefaults = namingDefaultsSchema.parse(JSON.parse(contents));
    return namingDefaults;
}
