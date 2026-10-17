// Holds back new releases while gspot installs its tools in .gspot, as the repository hold does.
import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { formatHold } from '#cli/generation/release-holds.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { GSPOT_PACKAGES, TOOL_HOLD_FILES, PNPM_IGNORE_WORKSPACE } from '#cli/config/generation/file-edits.ts';

/**
 * Add the hold to the lockfile run of the tool project. npm takes flags; Bun and pnpm read a settings file in the
 * folder they run in. Yarn gets the hold in its install settings file instead.
 *
 * @param work the scratch folder that the package manager runs in.
 * @param command the arguments to run.
 * @param packageManager npm, pnpm, Yarn, or Bun, with its version.
 * @param days the hold.
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
            minimumReleaseAge: formatHold('seconds', days),
            minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
        };
        writeFileSync(join(work, TOOL_HOLD_FILES.bun), stringifyToml({ install }));
        return [...command];
    }
    if (packageManager.name === 'pnpm') {
        const hold = { minimumReleaseAge: formatHold('minutes', days), minimumReleaseAgeExclude: [...GSPOT_PACKAGES] };
        writeFileSync(join(work, TOOL_HOLD_FILES.pnpm), stringify(hold));
        // pnpm skips pnpm-workspace.yaml with this flag; the file in the run folder already marks the project root.
        return command.filter((part) => part !== PNPM_IGNORE_WORKSPACE);
    }
    return [...command];
}
