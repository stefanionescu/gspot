import { join, posix } from 'node:path';

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
import { buildRootRelativePath } from '#cli/engine/outputs/formats.ts';
import { assertShippedCheck } from '#cli/engine/plan.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { normalizePythonName } from '#cli/parsers/projects/dependencies.ts';
import { findLockedPackageLine } from '#cli/parsers/projects/lockfiles.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { osvLicenseReportSchema } from '#cli/schemas/configurations.ts';
import { readSettingsText } from '#cli/settings/file.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { findSettingLine } from '#cli/settings/text.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildFilenameMatcher, buildPathMatcher } from '#cli/system/patterns.ts';
import type { AllowedPackage, LockedPackage } from '#cli/types/configurations/general.ts';
import type { PlannedCheck, ShippedPlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

async function readLockedPackages(session: CheckSession, planned: PlannedCheck): Promise<LockedPackage[]> {
    const { allowed } = getTable(planned.scope.settings, 'licenses');
    const lockfiles = listCheckedFiles(session.scopes, planned).filter(({ path }) => !isGspotPath(path));
    const cwd = join(session.root, planned.scope.path);
    const result = await runCheckTool(
        session,
        planned,
        [
            ...OSV_LICENSE_COMMAND,
            `${OSV_LICENSES_FLAG}=${allowed.join(',')}`,
            ...lockfiles.map(({ path }) => OSV_LOCKFILE_FLAG + posix.relative(planned.scope.path, path)),
        ],
        { cwd, exitCodes: [OSV_FINDINGS_CODE] },
    );
    const { results } = parseToolOutput(OSV_SCANNER_NAME, result.stdout, osvLicenseReportSchema);
    const posixRoot = convertToPosixPath(session.root);
    return results.flatMap(({ source, packages }) => {
        const file = buildRootRelativePath(source.path, cwd, posixRoot);
        const text = findText(session.cache, file) ?? '';
        return packages.map(({ package: locked, license_violations: licenses }) => ({
            file,
            line: findLockedPackageLine(text, locked.name, locked.version),
            name: locked.ecosystem === OSV_PYTHON_ECOSYSTEM ? normalizePythonName(locked.name) : locked.name,
            version: locked.version,
            isPython: locked.ecosystem === OSV_PYTHON_ECOSYSTEM,
            licenses,
        }));
    });
}

/**
Report each ignore that names this check and whose paths cover neither a lockfile nor gspot.toml. The check reports
at no other file, so such an ignore hides nothing.
*/
function listUnmatchedIgnores(session: CheckSession, planned: ShippedPlannedCheck): CheckFinding[] {
    const isLockfile = buildFilenameMatcher(planned.configuration.files.filenames);
    const reported = [
        SETTINGS_FILE,
        ...session.repository.files.map(({ path }) => path).filter((path) => isLockfile(path)),
    ];
    const { text } = readSettingsText(session.root);
    return session.settings.ignore.flatMap((ignore, index) => {
        if (ignore.check !== planned.check.id || ignore.paths === undefined) return [];
        const isIgnored = buildPathMatcher(ignore.paths);
        if (reported.some((path) => isIgnored(path))) return [];
        return [
            {
                file: SETTINGS_FILE,
                line: findSettingLine(text, session.settings.written, ['ignore', index]),
                rule: LICENSE_RULES.unmatchedIgnore,
                message: `The ignore for ${planned.check.id} with paths ${ignore.paths.join(', ')} covers no lockfile, so it ignores nothing. The check reports each package in its lockfile. Name the lockfile in paths, or remove the record.`,
            },
        ];
    });
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

async function checkAllowed(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    assertShippedCheck(planned);
    const packages = await readLockedPackages(session, planned);
    if (packages.length === 0) throw new CheckStop('missing', EMPTY_SCAN_MESSAGE);
    const { allowed_package: records } = getTable(planned.scope.settings, 'licenses');
    const disallowed = packages
        .filter((locked) => locked.licenses.length > 0)
        .filter((locked) => records.every((record) => !isPackageAllowed(record, locked)))
        .map(({ file, line, name, version, licenses }) => ({
            file,
            line,
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
    return [...disallowed, ...unused, ...listUnmatchedIgnores(session, planned)];
}

export const LICENSES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'licenses/allowed': { check: checkAllowed, explanations: LICENSE_EXPLANATIONS },
};
