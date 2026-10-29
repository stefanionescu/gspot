import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { MinimumReleaseAge } from '#cli/types/installers/install.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { MINUTES_PER_DAY, SECONDS_PER_DAY, RELEASE_AGE_FILES } from '#cli/config/installers/npm/release-age.ts';

/**
Add the minimum release age to the lockfile run of the tool project. npm takes flags, and pnpm reads a settings file in
the folder it runs in. Bun reads the file of writeBunReleaseAge.

@param runFolder the temporary folder that the package manager runs in.
@param command the arguments to run.
@param packageManager the manager and its version.
@param minimumReleaseAge the hold and the pins it exempts.
*/
export function prepareReleaseAge(
    runFolder: string,
    command: readonly string[],
    packageManager: PackageManager,
    minimumReleaseAge: MinimumReleaseAge,
): string[] {
    if (packageManager.name === 'npm')
        return [
            ...command,
            `--min-release-age=${String(minimumReleaseAge.days)}`,
            ...minimumReleaseAge.npmExclusions.map((name) => `--min-release-age-exclude=${name}`),
        ];
    if (packageManager.name === 'pnpm') {
        const hold = {
            minimumReleaseAge: minimumReleaseAge.days * MINUTES_PER_DAY,
            minimumReleaseAgeExclude: minimumReleaseAge.npmExclusions,
        };
        writeFileSync(join(runFolder, RELEASE_AGE_FILES.pnpm), stringify(hold));
    }
    return [...command];
}

/**
Write the Bun settings file that holds back new releases. Each Bun run reads it through --config.

@param folder the temporary settings folder of the run.
@param minimumReleaseAge the hold and the pins it exempts.
*/
export function writeBunReleaseAge(folder: string, minimumReleaseAge: MinimumReleaseAge): string {
    const install = {
        peer: false,
        minimumReleaseAge: minimumReleaseAge.days * SECONDS_PER_DAY,
        minimumReleaseAgeExcludes: minimumReleaseAge.npmExclusions,
    };
    const path = join(folder, RELEASE_AGE_FILES.bun);
    writeFileSync(path, stringifyToml({ install }));
    return path;
}
