import semver from 'semver';
import type { z } from 'zod';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listLicenseProjects } from '#cli/planning/tools.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { PYTHON_EXECUTABLE } from '#cli/config/tools/python.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import type { PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { getWrittenSetting, listSettingsTables } from '#cli/settings/inherit.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { splitIdentity, readLockedPackages } from '#cli/parsers/projects/lockfiles.ts';
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
    PYTHON_LOCKFILES,
    PIP_LICENSES_COMMAND,
    CLASSIFIER_SEPARATOR,
    LICENSE_CHECKER_COMMAND,
} from '#cli/config/checks/general/licenses.ts';

function isAllowed(license: string, allowed: readonly string[]): boolean {
    if (!isSpdxExpression(license)) return false;
    return satisfies(license, allowed);
}

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
    session: Session,
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
    session: Session,
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
    if (mapped.every((license) => license !== undefined)) return mapped.join(LICENSE_CHOICE);
    return report['License-Metadata'] ?? report['License-Classifier'] ?? UNKNOWN_LICENSE;
}

async function scanPythonLicenses(session: Session, planned: PlannedCheck, start: string): Promise<LicensedPackage[]> {
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

function hasProjectDependencies(session: Session, dependencyFile: string): boolean {
    if (basename(dependencyFile) !== PACKAGE_JSON) return true;
    return (readDependencySpecifiers(session.reads, dependencyFile)?.size ?? 0) > 0;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function normalizeIdentity(identity: string): string {
    const split = splitIdentity(identity);
    return split === undefined
        ? identity
        : `${split[0].toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${split[1]}`;
}

async function scanProject(session: Session, planned: PlannedCheck, project: LicenseProject): Promise<ProjectLicenses> {
    const { dependencyFile, scope } = project;
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
    const settings = project.settings;
    const scanned = await scan(session, { ...planned, scope }, start);
    if (scanned.length === 0)
        throw new Error(
            'The license scan found no packages. Install the selected project dependencies before scanning.',
        );
    const locked = readLockedPackages(session.reads, dirname(dependencyFile), lockfiles);
    let lockedKeys = locked;
    if (ecosystem === 'python' && locked !== undefined)
        lockedKeys = new Set([...locked].map((identity) => normalizeIdentity(identity)));
    const packages = lockedKeys === undefined ? scanned : scanned.filter(({ name }) => lockedKeys.has(name));
    return { dependencyFile, packages, locked: [...(lockedKeys ?? [])], ecosystem, settings };
}

async function scanLicenses(session: Session, planned: PlannedCheck) {
    const projects = listLicenseProjects(planned.files, session.scopes, session.settingsFile.settings, planned.check);
    if (projects.length === 0) throw new GspotError('skip', 'Set licenses.allowed to check licenses.');
    const inventories: ProjectLicenses[] = [];
    for (const project of projects.filter(({ skip }) => skip === undefined))
        if (hasProjectDependencies(session, project.dependencyFile))
            inventories.push(await scanProject(session, planned, project));
    return {
        inventories,
        skipped: projects.filter(({ skip }) => skip !== undefined).map(({ dependencyFile }) => dependencyFile),
    };
}

function matchesRecord(record: AllowedPackage, identity: string, ecosystem: ProjectLicenses['ecosystem']): boolean {
    const split = splitIdentity(identity);
    const wanted = splitIdentity(
        ecosystem === 'python'
            ? normalizeIdentity(`${record.name}@${record.version}`)
            : `${record.name}@${record.version}`,
    );
    if (split === undefined || wanted === undefined) return false;
    if (!buildPathMatcher([wanted[0]])(split[0])) return false;
    if ([ANY_VERSION, split[1]].includes(record.version)) return true;
    return semver.valid(split[1]) !== null && semver.validRange(record.version) !== null
        ? semver.satisfies(split[1], record.version, { includePrerelease: true })
        : false;
}

function isRecordInUse(record: AllowedPackage, project: ProjectLicenses): boolean {
    const { packages, locked, ecosystem } = project;
    const identities = [...packages.map(({ name }) => name), ...locked];
    return identities.some((identity) => matchesRecord(record, identity, ecosystem));
}

function listStaleRecords(
    session: Session,
    planned: PlannedCheck,
    inventories: ProjectLicenses[],
    skipped: string[],
): Finding[] {
    return listSettingsTables(session.settingsFile.settings).flatMap(({ table, scope = '' }) => {
        const authored = getWrittenSetting(table, 'licenses.allowed_package');
        if (authored === undefined || skipped.some((dependencyFile) => isInScope(dependencyFile, scope))) return [];
        const records = configurationTableSchemas.licenses
            .unwrap()
            .shape.allowed_package.unwrap()
            .parse(authored.value);
        const projects = inventories.filter(({ dependencyFile }) => isInScope(dependencyFile, scope));
        const where = scope === '' ? '' : ` in ${scope}`;
        return records
            .filter((record) => !projects.some((project) => isRecordInUse(record, project)))
            .map((record) =>
                buildFinding(
                    planned,
                    { file: SETTINGS_FILE, line: 1 },
                    'unused-record',
                    `${record.name}@${record.version} matches no locked or installed project dependency${where}. Remove the \`[[licenses.allowed_package]]\` record or correct its name or version.`,
                ),
            );
    });
}

/**
Reports disallowed licenses of locked packages, and allowed_package records that match no package.

@param session the repository and its tools.
@param planned the scopes whose dependencies to scan.
@returns the findings.
*/
export async function checkLicensesAllowed(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const { inventories, skipped } = await scanLicenses(session, planned);
    const findings = inventories.flatMap(({ dependencyFile, packages, ecosystem, settings }) => {
        return packages.flatMap(({ name, license }) => {
            const isRecorded = settings.allowed_package.some((record) => matchesRecord(record, name, ecosystem));
            if (isRecorded || isAllowed(license, settings.allowed)) return [];
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
    return [...findings, ...listStaleRecords(session, planned, inventories, skipped)];
}
