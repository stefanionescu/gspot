import semver from 'semver';
import type { z } from 'zod';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { PYTHON_EXECUTABLE } from '#cli/config/tools/uv.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listLicenseProjects } from '#cli/planning/tools.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import type { PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { splitIdentity, readLockedPackages } from '#cli/parsers/projects/lockfiles.ts';
import { PIP_LICENSES_COMMAND, LICENSE_CHECKER_COMMAND } from '#cli/config/licenses.ts';
import { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { PACKAGE_JSON, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';
import { pythonReportSchema, javascriptReportSchema } from '#cli/schemas/checks/general/licenses.ts';

import type {
    AllowedPackage,
    LicensedPackage,
    ProjectLicenses,
    PythonLicenseReport,
} from '#cli/types/checks/general/licenses.ts';
import {
    ANY_VERSION,
    LICENSE_CHOICE,
    TROVE_LICENSES,
    UNKNOWN_LICENSE,
    CLASSIFIER_SEPARATOR,
} from '#cli/config/checks/general/licenses.ts';

function isSpdxExpression(license: string): boolean {
    try {
        parseExpression(license);
        return true;
    } catch {
        return false;
    }
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function assertInstalled(planned: PlannedCheck, name: string, start: string): void {
    if (statSync(join(start, name), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new Error(
            `Install the project dependencies first: ${name} is missing in ${planned.scope.folder.path === '' ? 'the root' : planned.scope.folder.path}.`,
        );
}

async function readLicenseOutput<Value>(
    session: CheckSession,
    planned: PlannedCheck,
    command: [string, ...string[]],
    cwd: string,
    schema: z.ZodType<Value>,
): Promise<Value> {
    const result = await runCheckTool(session, planned, command, { cwd });
    if (result.code !== 0) throw new Error(`${command.join(' ')} did not run: ${formatOutputTail(result)}`);
    return parseToolReport(command[0], result.stdout, schema);
}

async function scanJavascriptLicenses(
    session: CheckSession,
    planned: PlannedCheck,
    start: string,
): Promise<LicensedPackage[]> {
    assertInstalled(planned, NODE_MODULES, start);
    const report = await readLicenseOutput(
        session,
        planned,
        [...LICENSE_CHECKER_COMMAND, start],
        start,
        javascriptReportSchema,
    );
    return Object.entries(report).map(([name, packageReport]) => ({
        name,
        license: Array.isArray(packageReport.licenses)
            ? packageReport.licenses.join(LICENSE_CHOICE)
            : (packageReport.licenses ?? UNKNOWN_LICENSE),
    }));
}

function selectPythonLicense(report: PythonLicenseReport): string {
    const expression = [report['License-Expression'], report['License-Metadata']].find(
        (field) => field !== undefined && field !== UNKNOWN_LICENSE && isSpdxExpression(field),
    );
    if (expression !== undefined) return expression;
    const mapped = (report['License-Classifier'] ?? UNKNOWN_LICENSE)
        .split(CLASSIFIER_SEPARATOR)
        .map((classifier) => TROVE_LICENSES[classifier]);
    return mapped.every((license) => license !== undefined)
        ? mapped.join(LICENSE_CHOICE)
        : (report['License-Metadata'] ?? report['License-Classifier'] ?? UNKNOWN_LICENSE);
}

async function scanPythonLicenses(
    session: CheckSession,
    planned: PlannedCheck,
    start: string,
): Promise<LicensedPackage[]> {
    assertInstalled(planned, PYTHON_ENVIRONMENT_FOLDER, start);
    const installed = join(start, PYTHON_ENVIRONMENT_FOLDER);
    using scratch = createTemporaryFolder();
    const report = await readLicenseOutput(
        session,
        planned,
        [...PIP_LICENSES_COMMAND, buildVenvExecutablePath(installed, PYTHON_EXECUTABLE)],
        scratch.path,
        pythonReportSchema,
    );
    return report.map((packageReport) => ({
        name: normalizeIdentity(`${packageReport.Name}@${packageReport.Version}`),
        license: selectPythonLicense(packageReport),
    }));
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function normalizeIdentity(identity: string): string {
    const split = splitIdentity(identity);
    return split === undefined
        ? identity
        : `${split[0].toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${split[1]}`;
}

async function scanProject(
    session: CheckSession,
    planned: PlannedCheck,
    project: LicenseProject,
): Promise<ProjectLicenses> {
    const { dependencyFile, scope, settings } = project;
    const folder = dirname(dependencyFile);
    const { scan, start, lockfiles, ecosystem } =
        basename(dependencyFile) === PACKAGE_JSON
            ? {
                  scan: scanJavascriptLicenses,
                  start: join(session.root, folder),
                  lockfiles: JAVASCRIPT_LOCKFILES,
                  ecosystem: 'npm' as const,
              }
            : {
                  scan: scanPythonLicenses,
                  start: join(session.installedRoot, folder),
                  lockfiles: PYTHON_LOCKFILES,
                  ecosystem: 'python' as const,
              };
    const scanned = await scan(session, { ...planned, scope }, start);
    if (scanned.length === 0)
        throw new Error(
            'The license scan found no packages. Install the selected project dependencies before scanning.',
        );
    const locked = readLockedPackages(session.reads, dirname(dependencyFile), lockfiles);
    const lockedKeys =
        ecosystem === 'python' && locked !== undefined
            ? new Set([...locked].map((identity) => normalizeIdentity(identity)))
            : locked;
    const packages = lockedKeys === undefined ? scanned : scanned.filter(({ name }) => lockedKeys.has(name));
    return { dependencyFile, packages, locked: [...(lockedKeys ?? [])], ecosystem, settings };
}

async function scanLicenses(session: CheckSession, planned: PlannedCheck) {
    const projects = listLicenseProjects(planned.files, session.scopes, session.settingsFile.settings, planned.check);
    if (projects.length === 0) throw new GspotError('skip', 'Set licenses.allowed to check licenses.');
    const inventories: ProjectLicenses[] = [];
    for (const project of projects) {
        if (
            project.skip === undefined &&
            (basename(project.dependencyFile) !== PACKAGE_JSON ||
                (readDependencySpecifiers(session.reads, project.dependencyFile)?.size ?? 0) > 0)
        )
            inventories.push(await scanProject(session, planned, project));
    }
    return { inventories, hasSkipped: projects.some(({ skip }) => skip !== undefined) };
}

function isPackageAllowed(record: AllowedPackage, identity: string, ecosystem: ProjectLicenses['ecosystem']): boolean {
    const split = splitIdentity(identity);
    const name =
        ecosystem === 'python' ? record.name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-') : record.name;
    if (split === undefined || !buildPathMatcher([name])(split[0])) return false;
    if ([ANY_VERSION, split[1]].includes(record.version)) return true;
    return (
        semver.valid(split[1]) !== null &&
        semver.validRange(record.version) !== null &&
        semver.satisfies(split[1], record.version, { includePrerelease: true })
    );
}

function isRecordInUse(record: AllowedPackage, project: ProjectLicenses): boolean {
    const { packages, locked, ecosystem } = project;
    const identities = [...packages.map(({ name }) => name), ...locked];
    return identities.some((identity) => isPackageAllowed(record, identity, ecosystem));
}

function listStaleRecords(planned: PlannedCheck, inventories: ProjectLicenses[]): Finding[] {
    return getTable(planned.scope.settings, 'licenses')
        .allowed_package.filter((record) => !inventories.some((project) => isRecordInUse(record, project)))
        .map((record) =>
            buildFinding(
                planned,
                { file: SETTINGS_FILE, line: 1 },
                'unused-record',
                `${record.name}@${record.version} matches no locked or installed project dependency. Remove the \`[[licenses.allowed_package]]\` record or correct its name or version.`,
            ),
        );
}

/**
Reports disallowed licenses of locked packages, and allowed_package records that match no package.

@param session the repository and its tools.
@param planned the scopes whose dependencies to scan.
@returns the findings.
*/
export async function checkLicensesAllowed(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const { inventories, hasSkipped } = await scanLicenses(session, planned);
    const findings = inventories.flatMap(({ dependencyFile, packages, ecosystem, settings }) => {
        return packages.flatMap(({ name, license }) => {
            const isListed = settings.allowed_package.some((record) => isPackageAllowed(record, name, ecosystem));
            if (isListed || (isSpdxExpression(license) && satisfies(license, settings.allowed))) return [];
            return [
                buildFinding(
                    planned,
                    { file: dependencyFile, line: 1 },
                    'disallowed-license',
                    `${name} uses ${license}, which is not allowed.`,
                ),
            ];
        });
    });
    return hasSkipped ? findings : [...findings, ...listStaleRecords(planned, inventories)];
}
