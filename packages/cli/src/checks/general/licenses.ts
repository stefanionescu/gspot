import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { findingAt } from '#cli/checks/finding.ts';
import { join, dirname, basename } from 'node:path';
import parseExpression from 'spdx-expression-parse';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { licenseProjects } from '#cli/planning/public.ts';
import { isInScope } from '#cli/repository/paths/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { LICENSE_CHECKER } from '#cli/config/checks/general/licenses.ts';
import { normalizedPythonIdentity } from '#cli/parsers/packages/public.ts';
import { everyTable, policyValue } from '#cli/policy/settings/contracts.ts';
import { reportSchema, allowlistSchema, pythonReportSchema } from '#cli/parsers/schema/licenses.ts';

import type {
    LicenseScanner,
    LicensedPackage,
    ProjectLicenses,
    LicenseException,
} from '#cli/types/checks/general/licenses.ts';

// A license expression passes when every part of a conjunction, or one part of a choice, is allowed.
function isAllowed(license: string, allow: Set<string>): boolean {
    try {
        parseExpression(license);
    } catch {
        return false;
    }
    return satisfies(license, [...allow]);
}

function licenseMessage(name: string, license: string, exception: LicenseException | undefined): string | undefined {
    if (exception === undefined) return `${name} reports ${license}, which is not an allowed license.`;
    if (exception.license === license) return undefined;
    return `${name} reports ${license}, and its exception names ${exception.license}; the exception no longer holds.`;
}

function assertInstalled(input: CheckInput, name: string): void {
    if (statSync(join(input.scopeRoot, name), { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new Error(
            `Install the project dependencies first: ${name} is missing in ${input.scope === '' ? 'the root' : input.scope}.`,
        );
}

async function licenseReport(input: CheckInput, command: string[], cwd: string): Promise<unknown> {
    const result = await runCheckTool(input, command, { cwd });
    if (result.code !== 0)
        throw new Error(
            `${command.join(' ')} did not run: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    return JSON.parse(result.stdout);
}

async function javascriptLicenses(input: CheckInput, start: string): Promise<LicensedPackage[]> {
    assertInstalled(input, 'node_modules');
    const report = await licenseReport(
        input,
        [LICENSE_CHECKER, '--json', '--excludePrivatePackages', '--start', start],
        start,
    );
    return Object.entries(reportSchema.parse(report)).map(([name, entry]) => ({
        name,
        license: Array.isArray(entry.licenses) ? entry.licenses.join(' OR ') : (entry.licenses ?? 'UNKNOWN'),
    }));
}

// Run outside the project so project-owned scanner settings cannot hide installed dependencies.
async function pythonLicenses(input: CheckInput, start: string): Promise<LicensedPackage[]> {
    assertInstalled(input, '.venv');
    const installed = join(start, '.venv');
    using isolatedFolder = scratchFolder('gspot-licenses-');
    const isolated = isolatedFolder.path;
    const report = await licenseReport(
        input,
        [
            'pip-licenses',
            '--format=json',
            '--with-system',
            '--from=mixed',
            '--python',
            environmentExecutable(installed, 'python'),
        ],
        isolated,
    );
    return pythonReportSchema
        .parse(report)
        .map((entry) => ({ name: `${entry.Name}@${entry.Version}`, license: entry.License }));
}

// Each installed project uses its deepest selected scope, while authored exceptions keep their table origin.
async function scanLicenses(input: CheckInput) {
    const inventories: ProjectLicenses[] = [];
    const projects = licenseProjects(input.files, input.selections, input.policyFiles.policy, input.check);
    for (const { manifest, selection, skip } of projects) {
        if (skip !== undefined) continue;
        const scanner: LicenseScanner =
            basename(manifest) === 'package.json'
                ? { scan: javascriptLicenses, packageKey: (name) => name }
                : { scan: pythonLicenses, packageKey: normalizedPythonIdentity };
        const scope = selection.scope.path;
        const selected = {
            ...input,
            selection,
            scope,
            scopeRoot: join(input.root, dirname(manifest)),
            view: selection.view,
        };
        const configuration = selected.view.options('licenses');
        const packages = await scanner.scan(selected, selected.scopeRoot);
        if (packages.length === 0)
            throw new Error(
                'The license scan found no packages. Install the selected project dependencies before scanning.',
            );
        inventories.push({ manifest, packages, packageKey: scanner.packageKey, configuration });
    }
    return { inventories, skipped: projects.filter(({ skip }) => skip !== undefined).map(({ manifest }) => manifest) };
}

/**
 * Report prohibited installed licenses, changed exception licenses, and authored exceptions for absent packages.
 * @param input the repository-wide check input.
 * @returns findings from each selected installed project and each authored exception origin.
 */
export async function licensesPackages(input: CheckInput): Promise<Finding[]> {
    const { inventories, skipped } = await scanLicenses(input);
    const findings = inventories.flatMap(({ manifest, packages, packageKey, configuration }) => {
        const allow = new Set(configuration.allowed);
        const exceptions = new Map(
            Object.entries(configuration.exceptions).map(([name, entry]) => [packageKey(name), entry]),
        );
        return packages.flatMap(({ name, license }) => {
            const exception = exceptions.get(packageKey(name));
            if (exception === undefined && isAllowed(license, allow)) return [];
            const text = licenseMessage(name, license, exception);
            return text === undefined
                ? []
                : [findingAt(input, { file: manifest, line: 1 }, 'disallowed-license', text)];
        });
    });
    const stale = everyTable(input.policyFiles.policy).flatMap(({ table, scope = '' }) => {
        const authored = policyValue(table, 'licenses.exceptions');
        if (authored === undefined || skipped.some((manifest) => isInScope(manifest, scope))) return [];
        const exceptions = allowlistSchema.shape.exceptions.parse(authored.value);
        const projects = inventories.filter(({ manifest }) => isInScope(manifest, scope));
        const where = scope === '' ? '' : ` in ${scope}`;
        return Object.keys(exceptions)
            .filter((name) => {
                for (const { packages, packageKey } of projects)
                    if (packages.some(({ name: installedName }) => packageKey(installedName) === packageKey(name)))
                        return false;
                return true;
            })
            .map((name) =>
                findingAt(
                    input,
                    { file: POLICY_FILE, line: 1 },
                    'stale-exception',
                    `${name} is absent from the installed project dependencies${where}. Remove the exception or correct its exact version.`,
                ),
            );
    });
    return [...findings, ...stale];
}
