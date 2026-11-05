import { realpathSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

import semver from 'semver';

import {
    ANY_VERSION,
    EMPTY_SCAN_MESSAGE,
    LICENSE_RULES,
    OSV_FINDINGS_CODE,
    OSV_LICENSE_COMMAND,
    OSV_LICENSES_FLAG,
    OSV_LOCKFILE_FLAG,
    OSV_PYTHON_ECOSYSTEM,
    OSV_SCANNER_NAME,
} from '#cli/config/configurations/general.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { LICENSE_EXPLANATIONS } from '#cli/configurations/general/licenses/explanations.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { normalizePythonName } from '#cli/parsers/projects/lockfiles.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { osvLicenseReportSchema } from '#cli/schemas/configurations.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { AllowedPackage, LockedPackage } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

async function readLockedPackages(session: CheckSession, planned: PlannedCheck): Promise<LockedPackage[]> {
    const { allowed } = getTable(planned.scope.settings, 'licenses');
    const lockfiles = listCheckedFiles(session.scopes, planned).filter(({ path }) => !isGspotPath(path));
    const result = await runCheckTool(
        session,
        planned,
        [
            ...OSV_LICENSE_COMMAND,
            `${OSV_LICENSES_FLAG}=${allowed.join(',')}`,
            ...lockfiles.map(({ path }) => OSV_LOCKFILE_FLAG + posix.relative(planned.scope.path, path)),
        ],
        { cwd: join(session.root, planned.scope.path), exitCodes: [OSV_FINDINGS_CODE] },
    );
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
async function checkAllowed(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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

export const LICENSES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'licenses/allowed': { check: checkAllowed, explanations: LICENSE_EXPLANATIONS },
};
