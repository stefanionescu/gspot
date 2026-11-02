import semver from 'semver';
import { realpathSync } from 'node:fs';
import { CheckStop } from '#cli/system/errors.ts';
import { join, posix, relative } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { osvLicenseReportSchema } from '#cli/schemas/configurations.ts';
import { normalizePythonName } from '#cli/parsers/projects/lockfiles.ts';
import type { LockedPackage, AllowedPackage } from '#cli/types/configurations/general.ts';

import {
    ANY_VERSION,
    LICENSE_RULES,
    OSV_EXCLUDE_FLAG,
    OSV_SCANNER_NAME,
    OSV_LICENSES_FLAG,
    OSV_FINDINGS_CODE,
    EMPTY_SCAN_MESSAGE,
    OSV_LICENSE_COMMAND,
    OSV_PYTHON_ECOSYSTEM,
} from '#cli/config/configurations/general.ts';

async function readLockedPackages(session: CheckSession, planned: PlannedCheck): Promise<LockedPackage[]> {
    const { allowed } = getTable(planned.scope.settings, 'licenses');
    const folder = join(session.root, planned.scope.path);
    const nested = listNestedScopes(
        session.scopes.map(({ path }) => path),
        planned.scope.path,
    );
    const result = await runCheckTool(
        session,
        planned,
        [
            ...OSV_LICENSE_COMMAND,
            ...nested.flatMap((path) => [OSV_EXCLUDE_FLAG, posix.relative(planned.scope.path, path)]),
            `${OSV_LICENSES_FLAG}=${allowed.join(',')}`,
            folder,
        ],
        { cwd: folder },
    );
    if (result.code > OSV_FINDINGS_CODE)
        throw new CheckStop('error', `osv-scanner did not run: ${formatOutputTail(result)}`);
    const { results } = parseToolOutput(OSV_SCANNER_NAME, result.stdout, osvLicenseReportSchema);
    const root = realpathSync(session.root);
    return results.flatMap(({ source, packages }) =>
        packages.map(({ package: locked, license_violations: licenses }) => ({
            file: convertToPosixPath(relative(root, source.path)),
            name: locked.ecosystem === OSV_PYTHON_ECOSYSTEM ? normalizePythonName(locked.name) : locked.name,
            version: locked.version,
            isPython: locked.ecosystem === OSV_PYTHON_ECOSYSTEM,
            licenses,
        })),
    );
}

function isPackageAllowed(record: AllowedPackage, { name, version, isPython }: LockedPackage): boolean {
    const pattern = isPython ? normalizePythonName(record.name) : record.name;
    if (!buildPathMatcher([pattern])(name)) return false;
    if ([ANY_VERSION, version].includes(record.version)) return true;
    return (
        semver.valid(version) !== null &&
        semver.validRange(record.version) !== null &&
        semver.satisfies(version, record.version, { includePrerelease: true })
    );
}

/**
Reports the locked packages whose license osv-scanner does not find on the allowed list, and allowed_package records
that match no locked package.

@param session the repository and its tools.
@param planned the scope whose lockfiles to scan.
*/
export async function checkAllowed(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const packages = await readLockedPackages(session, planned);
    if (packages.length === 0) throw new CheckStop('missing', EMPTY_SCAN_MESSAGE);
    const { allowed_package: records } = getTable(planned.scope.settings, 'licenses');
    const disallowed = packages
        .filter((locked) => locked.licenses.length > 0)
        .filter((locked) => records.every((record) => !isPackageAllowed(record, locked)))
        .map(({ file, name, version, licenses }) => ({
            file,
            line: 1,
            rule: LICENSE_RULES.disallowedLicense,
            message: `${name}@${version} uses ${licenses.join(' or ')}, which is not allowed.`,
        }));
    const unused = records
        .filter((record) => packages.every((locked) => !isPackageAllowed(record, locked)))
        .map((record) => ({
            file: SETTINGS_FILE,
            line: 1,
            rule: LICENSE_RULES.unusedRecord,
            message: `${record.name}@${record.version} matches no locked project dependency. Remove the \`[[licenses.allowed_package]]\` record or correct its name or version.`,
        }));
    return [...disallowed, ...unused];
}
