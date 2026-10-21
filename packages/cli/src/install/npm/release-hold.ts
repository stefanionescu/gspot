// Holds back new releases while gspot installs its tools in .gspot, as the repository hold does.
import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { MINUTES_PER_DAY, SECONDS_PER_DAY } from '#cli/config/units.ts';
import type { PackageManager } from '#cli/types/parsers/dependencies.ts';
import { GSPOT_PACKAGES, TOOL_HOLD_FILES } from '#cli/config/generation/file-edits.ts';

/**
 * Add the hold to the lockfile run of the tool project. npm takes flags; Bun and pnpm read a settings file in the
 * folder they run in. Yarn gets the hold in its install settings file instead.
 *
 * @param work the scratch folder that the package manager runs in.
 * @param command the arguments to run.
 * @param packageManager npm, pnpm, Yarn, or Bun, with its version.
 * @param days how long a new release waits.
 *
 * @returns the command to run.
 */
export function addToolReleaseHold(
    work: string,
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
            minimumReleaseAge: days * SECONDS_PER_DAY,
            minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
        };
        writeFileSync(join(work, TOOL_HOLD_FILES.bun), stringifyToml({ install }));
        return [...command];
    }
    if (packageManager.name === 'pnpm') {
        const hold = { minimumReleaseAge: days * MINUTES_PER_DAY, minimumReleaseAgeExclude: [...GSPOT_PACKAGES] };
        writeFileSync(join(work, TOOL_HOLD_FILES.pnpm), stringify(hold));
        return [...command];
    }
    return [...command];
}
