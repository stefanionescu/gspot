import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PackageManager } from '#cli/types/repository/javascript.ts';
import { GSPOT_PACKAGES, MINUTES_PER_DAY, SECONDS_PER_DAY, RELEASE_AGE_FILES } from '#cli/config/installers/npm.ts';

/**
Set the minimum release age for the tool project lockfile. Pass flags to npm and write local settings for pnpm and Bun.
The gspot packages install at the version of the CLI, so the hold skips them.

@param runFolder the temporary folder that the package manager runs in.
@param command the arguments to run.
@param packageManager the manager and its version.
@param days how long a new release waits.
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
