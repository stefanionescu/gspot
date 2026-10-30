import semver from 'semver';
import type { z } from 'zod';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listLicenseProjects } from '#cli/planning/tools.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { PYTHON_EXECUTABLE } from '#cli/config/executables/uv.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import type { PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { PIP_LICENSES_COMMAND, LICENSE_CHECKER_COMMAND } from '#cli/config/licenses.ts';
import { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { PACKAGE_JSON, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';
import { splitIdentity, PACKAGE_PARSERS, findNearestLockfile } from '#cli/parsers/projects/lockfiles.ts';
import { pythonLicenseOutputSchema, javascriptLicenseOutputSchema } from '#cli/schemas/checks/general/licenses.ts';

import type {
    AllowedPackage,
    LicensedPackage,
    ProjectLicenses,
    PythonLicenseOutput,
} from '#cli/types/checks/general/licenses.ts';
import {
    RULES,
    ANY_VERSION,
    LICENSE_CHOICE,
    TROVE_LICENSES,
    UNKNOWN_LICENSE,
    EMPTY_SCAN_MESSAGE,
    CLASSIFIER_SEPARATOR,
    NO_ALLOWED_LICENSES_NOTE,
} from '#cli/config/checks/general/licenses.ts';

function isSpdxExpression(license: string): boolean {
    try {
        parseExpression(license);
        return true;
    } catch {
        return false;
    }
}

async function readLicenseOutput<Value>(
    session: CheckSession,
    planned: PlannedCheck,
    command: [string, ...string[]],
    cwd: string,
    schema: z.ZodType<Value>,
): Promise<Value> {
    const result = await runCheckTool(session, planned, command, { cwd });
    if (result.code !== 0)
        throw new GspotError('check', `${command.join(' ')} did not run: ${formatOutputTail(result)}`);
    return parseToolOutput(command[0], result.stdout, schema);
}

async function scanJavascriptLicenses(
    session: CheckSession,
    planned: PlannedCheck,
    folder: string,
): Promise<LicensedPackage[]> {
    if (statSync(join(folder, NODE_MODULES), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new GspotError(
            'tool',
            `Install the project dependencies first: ${NODE_MODULES} is missing in ${planned.scope.path === '' ? 'the root' : planned.scope.path}.`,
        );
    const report = await readLicenseOutput(
        session,
        planned,
        [...LICENSE_CHECKER_COMMAND, folder],
        folder,
        javascriptLicenseOutputSchema,
    );
    return Object.entries(report).map(([name, packageReport]) => ({
        name,
        license: Array.isArray(packageReport.licenses)
            ? packageReport.licenses.join(LICENSE_CHOICE)
            : (packageReport.licenses ?? UNKNOWN_LICENSE),
    }));
}

function selectPythonLicense(output: PythonLicenseOutput): string {
    const expression = [output['License-Expression'], output['License-Metadata']].find(
        (field) => field !== undefined && field !== UNKNOWN_LICENSE && isSpdxExpression(field),
    );
    if (expression !== undefined) return expression;
    const mapped = (output['License-Classifier'] ?? UNKNOWN_LICENSE)
        .split(CLASSIFIER_SEPARATOR)
        .map((classifier) => TROVE_LICENSES[classifier]);
    return mapped.every((license) => license !== undefined)
        ? mapped.join(LICENSE_CHOICE)
        : (output['License-Metadata'] ?? output['License-Classifier'] ?? UNKNOWN_LICENSE);
}

async function scanPythonLicenses(
    session: CheckSession,
    planned: PlannedCheck,
    folder: string,
): Promise<LicensedPackage[]> {
    if (statSync(join(folder, PYTHON_ENVIRONMENT_FOLDER), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new GspotError(
            'tool',
            `Install the project dependencies first: ${PYTHON_ENVIRONMENT_FOLDER} is missing in ${planned.scope.path === '' ? 'the root' : planned.scope.path}.`,
        );
    const installed = join(folder, PYTHON_ENVIRONMENT_FOLDER);
    using scratch = createTemporaryFolder();
    const report = await readLicenseOutput(
        session,
        planned,
        [...PIP_LICENSES_COMMAND, buildVenvExecutablePath(installed, PYTHON_EXECUTABLE)],
        scratch.path,
        pythonLicenseOutputSchema,
    );
    return report.map((packageReport) => {
        const identity = `${packageReport.Name}@${packageReport.Version}`;
        const split = splitIdentity(identity);
        return {
            name:
                split === undefined
                    ? identity
                    : `${split[0].toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${split[1]}`,
            license: selectPythonLicense(packageReport),
        };
    });
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
                  start: join(session.toolsRoot, folder),
                  lockfiles: PYTHON_LOCKFILES,
                  ecosystem: 'python' as const,
              };
    const scanned = await scan(session, { ...planned, scope }, start);
    if (scanned.length === 0) throw new GspotError('tool', EMPTY_SCAN_MESSAGE);
    const found = findNearestLockfile(session.cache, dirname(dependencyFile), lockfiles);
    const locked = found === undefined ? undefined : new Set(PACKAGE_PARSERS[found.lockfile](found.path, found.text));
    const lockedKeys =
        ecosystem === 'python' && locked !== undefined
            ? new Set(
                  [...locked].map((identity) => {
                      const split = splitIdentity(identity);
                      return split === undefined
                          ? identity
                          : `${split[0].toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${split[1]}`;
                  }),
              )
            : locked;
    const packages = lockedKeys === undefined ? scanned : scanned.filter(({ name }) => lockedKeys.has(name));
    return { dependencyFile, packages, locked: [...(lockedKeys ?? [])], ecosystem, settings };
}

async function scanLicenses(session: CheckSession, planned: PlannedCheck) {
    const projects = listLicenseProjects(planned.files, session.scopes, session.settings, planned.check);
    if (projects.length === 0) throw new GspotError('skip', NO_ALLOWED_LICENSES_NOTE);
    const scanned = projects.filter(
        (project) =>
            project.skip === undefined &&
            (basename(project.dependencyFile) !== PACKAGE_JSON ||
                (readDependencySpecifiers(session.cache, project.dependencyFile)?.size ?? 0) > 0),
    );
    const inventories = await Promise.all(scanned.map((project) => scanProject(session, planned, project)));
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

function listUnusedRecords(planned: PlannedCheck, inventories: ProjectLicenses[]): CheckFinding[] {
    return getTable(planned.scope.settings, 'licenses')
        .allowed_package.filter((record) => !inventories.some((project) => isRecordInUse(record, project)))
        .map((record) => ({
            file: SETTINGS_FILE,
            line: 1,
            rule: RULES.unusedRecord,
            message: `${record.name}@${record.version} matches no locked or installed project dependency. Remove the \`[[licenses.allowed_package]]\` record or correct its name or version.`,
        }));
}

/**
Reports disallowed licenses of locked packages, and allowed_package records that match no package.

@param session the repository and its tools.
@param planned the scopes whose dependencies to scan.
*/
export async function checkAllowed(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { inventories, hasSkipped } = await scanLicenses(session, planned);
    const findings = inventories.flatMap(({ dependencyFile, packages, ecosystem, settings }) => {
        return packages.flatMap(({ name, license }) => {
            const isListed = settings.allowed_package.some((record) => isPackageAllowed(record, name, ecosystem));
            if (isListed || (isSpdxExpression(license) && satisfies(license, settings.allowed))) return [];
            return [
                {
                    file: dependencyFile,
                    line: 1,
                    rule: RULES.disallowedLicense,
                    message: `${name} uses ${license}, which is not allowed.`,
                },
            ];
        });
    });
    return hasSkipped ? findings : [...findings, ...listUnusedRecords(planned, inventories)];
}
