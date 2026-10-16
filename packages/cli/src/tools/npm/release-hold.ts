// Holds back new releases while gspot installs its tools in .gspot, as the repository hold does.
import { join } from 'node:path';
import { stringify } from 'yaml';
import { writeFileSync } from 'node:fs';
import { formatHold } from '#cli/generation/release-holds.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { GSPOT_PACKAGES, TOOL_HOLD_FILES, PNPM_IGNORE_WORKSPACE } from '#cli/config/generation/file-edits.ts';

/**
 * Add the hold to one package manager run in the tool project. npm takes flags; Bun and pnpm read a settings file
 * in the folder they run in. Yarn gets the hold in its install settings file instead.
 *
 * @param work the folder that the package manager runs in.
 * @param command the package manager command.
 * @param packageManager the package manager.
 * @param days the hold.
 *
 * @returns the command to run, and the settings file to delete after it.
 */
export function addToolReleaseHold(
    work: string,
    command: readonly string[],
    packageManager: PackageManager,
    days: number,
): { command: string[]; written: string | undefined } {
    if (packageManager.name === 'npm')
        return {
            command: [
                ...command,
                `--min-release-age=${String(days)}`,
                ...GSPOT_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
            ],
            written: undefined,
        };
    if (packageManager.name === 'bun') {
        const install = {
            minimumReleaseAge: formatHold('seconds', days),
            minimumReleaseAgeExcludes: [...GSPOT_PACKAGES],
        };
        writeFileSync(join(work, TOOL_HOLD_FILES.bun), stringifyToml({ install }));
        return { command: [...command], written: TOOL_HOLD_FILES.bun };
    }
    if (packageManager.name === 'pnpm') {
        const hold = { minimumReleaseAge: formatHold('minutes', days), minimumReleaseAgeExclude: [...GSPOT_PACKAGES] };
        writeFileSync(join(work, TOOL_HOLD_FILES.pnpm), stringify(hold));
        // pnpm skips pnpm-workspace.yaml with this flag; the file in the run folder already marks the project root.
        return { command: command.filter((part) => part !== PNPM_IGNORE_WORKSPACE), written: TOOL_HOLD_FILES.pnpm };
    }
    return { command: [...command], written: undefined };
}
