import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import type { PackageManager } from '#cli/types/repository.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { GSPOT_PACKAGES } from '#cli/config/repository/javascript.ts';
import { MINUTES_PER_DAY, SECONDS_PER_DAY, RELEASE_AGE_FILES } from '#cli/config/tools/installers.ts';

/**
Add the minimum release age to an npm or pnpm command. Bun reads the file that writeBunReleaseAge writes.
The gspot packages install at the version of the CLI, so the hold skips them.

@param command the arguments to run.
@param packageManager the manager and its version.
@param days how long a new release waits.
*/
export function prepareReleaseAge(command: readonly string[], packageManager: PackageManager, days: number): string[] {
    if (packageManager.name === 'npm')
        return [
            ...command,
            `--min-release-age=${String(days)}`,
            ...GSPOT_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
        ];
    if (packageManager.name === 'pnpm')
        return [
            ...command,
            `--config.minimum-release-age=${String(days * MINUTES_PER_DAY)}`,
            ...GSPOT_PACKAGES.map((name) => `--config.minimum-release-age-exclude=${name}`),
        ];
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
