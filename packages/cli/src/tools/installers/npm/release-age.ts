import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { stringify as stringifyToml } from '@decimalturn/toml-patch';

import { GSPOT_PACKAGES } from '#cli/config/repository/version-pin.ts';
import { BUNFIG_FILE, MINUTES_PER_DAY, SECONDS_PER_DAY } from '#cli/config/tools/installers.ts';
import type { PackageManager } from '#cli/types/repository.ts';

/**
Add the minimum release age to an npm or pnpm command. Bun reads the file that writeBunReleaseAge writes.
The gspot packages install at the version of the CLI, so the hold skips them.
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

export function writeBunReleaseAge(folder: string, days: number): string {
    const install = {
        peer: false,
        minimumReleaseAge: days * SECONDS_PER_DAY,
        minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
    };
    const path = join(folder, BUNFIG_FILE);
    writeFileSync(path, stringifyToml({ install }));
    return path;
}
