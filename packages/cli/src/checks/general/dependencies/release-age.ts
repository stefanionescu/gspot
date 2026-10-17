import semver from 'semver';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { parsePackageManagerField } from '#cli/tools/npm/package-manager.ts';
import { HOLD_VERSIONS, PACKAGE_MANAGER_FIELD } from '#cli/config/checks/general/dependencies.ts';

/**
 * Checks that the packageManager of the root package.json can hold back new releases.
 * @param input the scope files.
 * @returns one finding for a version that ignores the hold.
 */
export function checkReleaseAge(input: CheckInput): Finding[] {
    if (!input.files.some(({ kind, path }) => kind === 'source' && path === PACKAGE_JSON)) return [];
    const text = readCachedBytes(input.reads, PACKAGE_JSON).toString('utf8');
    const field = parseJsonFile(PACKAGE_JSON, text, packageJsonSchema).packageManager;
    if (field === undefined) return [];
    const { name, version } = parsePackageManagerField(field);
    const floor = HOLD_VERSIONS[name];
    if (version === undefined || semver.gte(version, floor.version)) return [];
    const line = text.split('\n').findIndex((row) => row.includes(PACKAGE_MANAGER_FIELD)) + 1;
    return [
        buildFinding(
            input,
            { file: PACKAGE_JSON, line: Math.max(line, 1) },
            'release-age',
            `${name} ${version} ignores ${floor.key}, so it installs new releases at once. Use ${name} ${floor.version} or newer.`,
        ),
    ];
}
