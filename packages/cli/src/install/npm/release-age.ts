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
Add the minimum release age to the lockfile run of the tool project. npm takes flags; pnpm reads a settings file in the
folder it runs in. Bun reads it from the file of writeBunReleaseAge, and Yarn from its install settings file.

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
    if (packageManager.name === 'pnpm') {
        const hold = { minimumReleaseAge: days * MINUTES_PER_DAY, minimumReleaseAgeExclude: [...GSPOT_PACKAGES] };
        writeFileSync(join(runFolder, RELEASE_AGE_FILES.pnpm), stringify(hold));
    }
    return [...command];
}

/**
Write the Bun settings file that holds back new releases. Each Bun run reads it through --config.

@param folder the temporary settings folder of the run.
@param days how long a new release waits.
@returns the path of the settings file.
*/
export function writeBunReleaseAge(folder: string, days: number): string {
    const install = {
        peer: false,
        minimumReleaseAge: days * SECONDS_PER_DAY,
        minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
    };
    const path = join(folder, RELEASE_AGE_FILES.bun);
    writeFileSync(path, stringifyToml({ install }));
    return path;
}
