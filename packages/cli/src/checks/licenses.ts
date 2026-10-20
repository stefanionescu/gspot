import { z } from 'zod';
import semver from 'semver';
import picomatch from 'picomatch';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { LicenseProject } from '#cli/types/planning.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { listLicenseProjects } from '#cli/planning/needed-tools.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { getWrittenSetting, listSettingsTables } from '#cli/settings/inherit.ts';
import { splitIdentity, readLockedPackages } from '#cli/parsers/lockfile-packages.ts';
import { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { packageJsonSchema, normalizePythonPackage } from '#cli/parsers/dependency-files.ts';
import { PIP_LICENSES_COMMAND, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import type { AllowedPackage, LicensedPackage, ProjectLicenses } from '#cli/types/checks/licenses.ts';

import {
    ANY_VERSION,
    LICENSE_CHOICE,
    TROVE_LICENSES,
    LICENSE_CHECKER,
    UNKNOWN_LICENSE,
    CLASSIFIER_SEPARATOR,
    LICENSE_CHECKER_ARGUMENTS,
} from '#cli/config/checks/licenses.ts';

// An expression passes when every part of an `AND`, or one part of an `OR`, has an allowed license.
function isAllowed(license: string, allow: Set<string>): boolean {
    if (!isSpdxExpression(license)) return false;
    return satisfies(license, [...allow]);
}

function isSpdxExpression(license: string): boolean {
    try {
        parseExpression(license);
        return true;
    } catch {
        return false;
    }
}

function assertInstalled(input: CheckInput, name: string, start: string): void {
    if (statSync(join(start, name), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new Error(
            `Install the project dependencies first: ${name} is missing in ${input.selection.scope.path === '' ? 'the root' : input.selection.scope.path}.`,
        );
}

async function readLicenseOutput(input: CheckInput, command: string[], cwd: string): Promise<unknown> {
    const result = await runCheckTool(input, command, { cwd });
    if (result.code !== 0) throw new Error(`${command.join(' ')} did not run: ${formatOutputTail(result)}`);
    return JSON.parse(result.stdout);
}

async function scanJavascriptLicenses(input: CheckInput, start: string): Promise<LicensedPackage[]> {
    assertInstalled(input, NODE_MODULES, start);
    const report = await readLicenseOutput(input, [LICENSE_CHECKER, ...LICENSE_CHECKER_ARGUMENTS, start], start);
    return Object.entries(javascriptReportSchema.parse(report)).map(([name, entry]) => ({
        name,
        license: Array.isArray(entry.licenses)
            ? entry.licenses.join(LICENSE_CHOICE)
            : (entry.licenses ?? UNKNOWN_LICENSE),
    }));
}

function findExpression(entry: PythonLicenseReport): string | undefined {
    return [entry['License-Expression'], entry['License-Metadata']].find(
        (field) => field !== undefined && field !== UNKNOWN_LICENSE && isSpdxExpression(field),
    );
}

// A package states its license as an expression, as free text, or as trove classifiers; take the first that names
// license IDs. Several classifiers mean a choice of licenses.
function selectPythonLicense(entry: PythonLicenseReport): string {
    const expression = findExpression(entry);
    if (expression !== undefined) return expression;
    const mapped = (entry['License-Classifier'] ?? UNKNOWN_LICENSE)
        .split(CLASSIFIER_SEPARATOR)
        .map((classifier) => TROVE_LICENSES[classifier]);
    if (mapped.every((license) => license !== undefined)) return mapped.join(LICENSE_CHOICE);
    return entry['License-Metadata'] ?? entry['License-Classifier'] ?? UNKNOWN_LICENSE;
}

// Run outside the project so project-owned scanner settings cannot hide installed dependencies.
async function scanPythonLicenses(input: CheckInput, start: string): Promise<LicensedPackage[]> {
    assertInstalled(input, PYTHON_ENVIRONMENT_FOLDER, start);
    const installed = join(start, PYTHON_ENVIRONMENT_FOLDER);
    using scratch = createScratchFolder();
    const report = await readLicenseOutput(
        input,
        [...PIP_LICENSES_COMMAND, buildVenvExecutablePath(installed, 'python')],
        scratch.path,
    );
    return pythonReportSchema
        .parse(report)
        .map((entry) => ({ name: `${entry.Name}@${entry.Version}`, license: selectPythonLicense(entry) }));
}

function hasProjectDependencies(input: CheckInput, dependencyFile: string): boolean {
    if (basename(dependencyFile) !== 'package.json') return true;
    const project = parseJsonFile(
        dependencyFile,
        readCachedBytes(input.reads, dependencyFile).toString('utf8'),
        packageJsonSchema,
    );
    return (
        Object.keys({ ...project.dependencies, ...project.devDependencies, ...project.optionalDependencies }).length > 0
    );
}

function normalizeIdentity(identity: string): string {
    const parts = splitIdentity(identity);
    return parts === undefined ? identity : `${normalizePythonPackage(parts[0])}@${parts[1]}`;
}

// The hook checks a pushed revision in a copy without a Python environment, so the scan reads the working tree's. The
// node_modules folders reach the copy through links.
function selectScanner(input: CheckInput, dependencyFile: string) {
    const folder = dirname(dependencyFile);
    return basename(dependencyFile) === 'package.json'
        ? {
              scan: scanJavascriptLicenses,
              start: join(input.root, folder),
              lockfiles: JAVASCRIPT_LOCKFILES,
              packageKey: (name: string) => name,
          }
        : {
              scan: scanPythonLicenses,
              start: join(input.installedRoot, folder),
              lockfiles: PYTHON_LOCKFILES,
              packageKey: normalizeIdentity,
          };
}

// The scan keeps the packages that the lockfile holds, so a package left behind in node_modules or a host
// environment stays out.
async function scanProject(input: CheckInput, project: LicenseProject): Promise<ProjectLicenses> {
    const { dependencyFile, selection } = project;
    const { scan, start, lockfiles, packageKey } = selectScanner(input, dependencyFile);
    const configuration = selection.view.options('licenses');
    const scanned = await scan({ ...input, selection }, start);
    if (scanned.length === 0)
        throw new Error(
            'The license scan found no packages. Install the selected project dependencies before scanning.',
        );
    const locked = readLockedPackages(input.reads, dirname(dependencyFile), lockfiles);
    const lockedKeys = locked === undefined ? undefined : new Set([...locked].map((identity) => packageKey(identity)));
    const packages =
        lockedKeys === undefined ? scanned : scanned.filter(({ name }) => lockedKeys.has(packageKey(name)));
    return { dependencyFile, packages, locked: [...(lockedKeys ?? [])], packageKey, configuration };
}

// Each installed project uses its deepest scope; authored exceptions keep the table they came from.
async function scanLicenses(input: CheckInput) {
    const projects = listLicenseProjects(input.files, input.selections, input.settingsFile.settings, input.check);
    if (projects.length === 0) throw new GspotError('skip', 'Set licenses.allowed to check licenses.');
    const inventories: ProjectLicenses[] = [];
    for (const project of projects.filter(({ skip }) => skip === undefined))
        if (hasProjectDependencies(input, project.dependencyFile)) inventories.push(await scanProject(input, project));
    return {
        inventories,
        skipped: projects.filter(({ skip }) => skip !== undefined).map(({ dependencyFile }) => dependencyFile),
    };
}

function matchesRecord(record: AllowedPackage, identity: string, packageKey: (name: string) => string): boolean {
    const parts = splitIdentity(packageKey(identity));
    const wanted = splitIdentity(packageKey(`${record.name}@${record.version}`));
    if (parts === undefined || wanted === undefined) return false;
    if (!picomatch.isMatch(parts[0], wanted[0], { dot: true })) return false;
    if (record.version === ANY_VERSION || record.version === parts[1]) return true;
    return semver.valid(parts[1]) !== null && semver.validRange(record.version) !== null
        ? semver.satisfies(parts[1], record.version, { includePrerelease: true })
        : false;
}

const licenseSchema = z.object({
    licenses: z.union([z.string(), z.array(z.string())]).optional(),
} satisfies SchemaShape<{ licenses?: string | string[] | undefined }>);

const javascriptReportSchema = z.record(z.string(), licenseSchema) satisfies z.ZodType<
    Record<string, { licenses?: string | string[] | undefined }>
>;

type PythonLicenseReport = {
    Name: string;
    Version: string;
    'License-Expression'?: string | undefined;
    'License-Metadata'?: string | undefined;
    'License-Classifier'?: string | undefined;
};

const pythonReportSchema = z.array(
    z.object({
        Name: z.string().min(1),
        Version: z.string().min(1),
        'License-Expression': z.string().optional(),
        'License-Metadata': z.string().optional(),
        'License-Classifier': z.string().optional(),
    } satisfies SchemaShape<PythonLicenseReport>),
) satisfies z.ZodType<PythonLicenseReport[]>;

function isRecordInUse(record: AllowedPackage, project: ProjectLicenses): boolean {
    const { packages, locked, packageKey } = project;
    const identities = [...packages.map(({ name }) => name), ...locked];
    return identities.some((identity) => matchesRecord(record, identity, packageKey));
}

// A record that no installed package matches has gone stale, unless the lockfile holds a matching package for another
// platform, such as an optional native build.
function listStaleRecords(input: CheckInput, inventories: ProjectLicenses[], skipped: string[]): Finding[] {
    return listSettingsTables(input.settingsFile.settings).flatMap(({ table, scope = '' }) => {
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
                    input,
                    { file: SETTINGS_FILE, line: 1 },
                    'unused-record',
                    `${record.name}@${record.version} matches no locked or installed project dependency${where}. Remove the \`[[licenses.allowed_package]]\` record or correct its name or version.`,
                ),
            );
    });
}

/**
 * Reports disallowed licenses of locked packages, and allowed_package records that match no package.
 *
 * @param input the scopes whose dependencies to scan.
 * @returns the findings.
 */
export async function checkAllowedLicenses(input: CheckInput): Promise<Finding[]> {
    const { inventories, skipped } = await scanLicenses(input);
    const findings = inventories.flatMap(({ dependencyFile, packages, packageKey, configuration }) => {
        const allow = new Set(configuration.allowed);
        return packages.flatMap(({ name, license }) => {
            const isRecorded = configuration.allowed_package.some((record) => matchesRecord(record, name, packageKey));
            if (isRecorded || isAllowed(license, allow)) return [];
            return [
                buildFinding(
                    input,
                    { file: dependencyFile, line: 1 },
                    'disallowed-license',
                    `${name} uses ${license}, which is not allowed.`,
                ),
            ];
        });
    });
    return [...findings, ...listStaleRecords(input, inventories, skipped)];
}
