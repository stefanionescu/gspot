import { z } from 'zod';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { listLicenseProjects } from '#cli/planning/needed-tools.ts';
import { formatOutputTail } from '#cli/checks/run/command/output.ts';
import { configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { PYTHON_IDENTITY_NAME } from '#cli/config/parsers/dependency-files.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { getWrittenSetting, listSettingsTables } from '#cli/settings/inherit.ts';
import { type LicensedPackage, type ProjectLicenses } from '#cli/types/checks/general.ts';
import { packageJsonSchema, normalizePythonPackage } from '#cli/parsers/dependency-files.ts';
import { PIP_LICENSES_COMMAND, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';

import {
    LICENSE_CHOICE,
    LICENSE_CHECKER,
    UNKNOWN_LICENSE,
    LICENSE_CHECKER_ARGUMENTS,
} from '#cli/config/checks/general/licenses.ts';

// A license expression passes when every part of a conjunction, or one part of a choice, passes the allowed-license check.
function isAllowed(license: string, allow: Set<string>): boolean {
    try {
        parseExpression(license);
    } catch {
        return false;
    }
    return satisfies(license, [...allow]);
}

function assertInstalled(input: CheckInput, name: string, start: string): void {
    if (statSync(join(start, name), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new Error(
            `Install the project dependencies first: ${name} is missing in ${input.scope.scope.path === '' ? 'the root' : input.scope.scope.path}.`,
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
        .map((entry) => ({ name: `${entry.Name}@${entry.Version}`, license: entry.License }));
}

function hasProjectDependencies(input: CheckInput, manifest: string): boolean {
    if (basename(manifest) !== 'package.json') return true;
    const project = parseJsonFile(manifest, readCachedBytes(input.reads, manifest).toString('utf8'), packageJsonSchema);
    return (
        Object.keys({ ...project.dependencies, ...project.devDependencies, ...project.optionalDependencies }).length > 0
    );
}

// Each installed project uses its deepest selected scope, while authored exceptions keep their table origin.
async function scanLicenses(input: CheckInput) {
    const inventories: ProjectLicenses[] = [];
    const projects = listLicenseProjects(input.files, input.selections, input.settingsFile.settings, input.check);
    for (const { manifest, selection } of projects.filter(({ skip }) => skip === undefined)) {
        if (!hasProjectDependencies(input, manifest)) continue;
        const scanner =
            basename(manifest) === 'package.json'
                ? { scan: scanJavascriptLicenses, packageKey: (name: string) => name }
                : {
                      scan: scanPythonLicenses,
                      packageKey: (identity: string) => identity.replace(PYTHON_IDENTITY_NAME, normalizePythonPackage),
                  };
        const selected = {
            ...input,
            scope: selection,
        };
        const configuration = selected.scope.view.options('licenses');
        const packages = await scanner.scan(selected, join(input.root, dirname(manifest)));
        if (packages.length === 0)
            throw new Error(
                'The license scan found no packages. Install the selected project dependencies before scanning.',
            );
        inventories.push({ dependencyFile: manifest, packages, packageKey: scanner.packageKey, configuration });
    }
    return { inventories, skipped: projects.filter(({ skip }) => skip !== undefined).map(({ manifest }) => manifest) };
}

const licenseSchema = z.object({
    licenses: z.union([z.string(), z.array(z.string())]).optional(),
} satisfies SchemaShape<{ licenses?: string | string[] | undefined }>);

const javascriptReportSchema = z.record(z.string(), licenseSchema) satisfies z.ZodType<
    Record<string, { licenses?: string | string[] | undefined }>
>;

const pythonReportSchema = z.array(
    z.object({ Name: z.string().min(1), Version: z.string().min(1), License: z.string().min(1) } satisfies SchemaShape<
        { Name: string; Version: string; License: string }[][number]
    >),
) satisfies z.ZodType<{ Name: string; Version: string; License: string }[]>;

/**
 * Report prohibited installed licenses and allowed_package records for absent packages.
 * @param input the repository-wide check input.
 * @returns findings from the installed projects and unused allowed_package records.
 */
export async function checkAllowedLicenses(input: CheckInput): Promise<Finding[]> {
    const { inventories, skipped } = await scanLicenses(input);
    const findings = inventories.flatMap(({ dependencyFile: manifest, packages, packageKey, configuration }) => {
        const allow = new Set(configuration.allowed);
        const exceptions = new Map(
            configuration.allowed_package.map((entry) => [packageKey(`${entry.name}@${entry.version}`), entry]),
        );
        return packages.flatMap(({ name, license }) => {
            const exception = exceptions.get(packageKey(name));
            if (exception !== undefined || isAllowed(license, allow)) return [];
            return [
                buildFinding(
                    input,
                    { file: manifest, line: 1 },
                    'disallowed-license',
                    `${name} uses ${license}, which is not allowed.`,
                ),
            ];
        });
    });
    const stale = listSettingsTables(input.settingsFile.settings).flatMap(({ table, scope = '' }) => {
        const authored = getWrittenSetting(table, 'licenses.allowed_package');
        if (authored === undefined || skipped.some((manifest) => isInScope(manifest, scope))) return [];
        const exceptions = configurationTableSchemas.licenses
            .unwrap()
            .shape.allowed_package.unwrap()
            .parse(authored.value);
        const projects = inventories.filter(({ dependencyFile: manifest }) => isInScope(manifest, scope));
        const where = scope === '' ? '' : ` in ${scope}`;
        return exceptions
            .map((entry) => `${entry.name}@${entry.version}`)
            .filter((name) => {
                for (const { packages, packageKey } of projects)
                    if (packages.some(({ name: installedName }) => packageKey(installedName) === packageKey(name)))
                        return false;
                return true;
            })
            .map((name) =>
                buildFinding(
                    input,
                    { file: SETTINGS_FILE, line: 1 },
                    'unused-record',
                    `${name} is absent from the installed project dependencies${where}. Remove the \`[[licenses.allowed_package]]\` record or correct its exact version.`,
                ),
            );
    });
    return [...findings, ...stale];
}
