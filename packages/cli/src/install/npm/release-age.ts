import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

import {
    GSPOT_PACKAGES,
    MINUTES_PER_DAY,
    SECONDS_PER_DAY,
    RELEASE_AGE_FILES,
} from '#cli/config/install/npm/release-age.ts';

/**
Add the minimum release age to the lockfile run of the tool project. npm takes flags; Bun and pnpm read a settings
file in the folder they run in. Yarn reads it from its install settings file instead.

@param runFolder the temporary folder that the package manager runs in.
@param command the arguments to run.
@param packageManager npm, pnpm, Yarn, or Bun, with its version.
@param days how long a new release waits.
@returns the command to run.
*/
export function prepareReleaseAge(
    runFolder: string,
    command: readonly string[],
    packageManager: PackageManager,
    days: number,
): string[] {
    if (packageManager.name === 'npm')
        return [
            ...command,
            `--min-release-age=${String(days)}`,
            ...GSPOT_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
        ];
    if (packageManager.name === 'bun') {
        const install = {
            peer: false,
            minimumReleaseAge: days * SECONDS_PER_DAY,
            minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
        };
        writeFileSync(join(runFolder, RELEASE_AGE_FILES.bun), stringifyToml({ install }));
        return [...command];
    }
    if (packageManager.name === 'pnpm') {
        const hold = { minimumReleaseAge: days * MINUTES_PER_DAY, minimumReleaseAgeExclude: [...GSPOT_PACKAGES] };
        writeFileSync(join(runFolder, RELEASE_AGE_FILES.pnpm), stringify(hold));
        return [...command];
    }
    return [...command];
}
