import { join } from 'node:path';
import { statSync } from 'node:fs';
import satisfies from 'spdx-satisfies';
import { isDeepStrictEqual } from 'node:util';
import { findingAt } from '#cli/checks/finding.ts';
import parseExpression from 'spdx-expression-parse';
import { openRoot } from '#cli/platform/root/open.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { normalizedPythonIdentity } from '#cli/parsers/packages.ts';
import { targetInScope } from '#cli/configurations/declarations.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { LICENSE_CHECKER } from '#cli/config/checks/general/licenses.ts';
import { reportSchema, allowlistSchema, pythonReportSchema } from '#cli/parsers/schema/licenses.ts';

import type {
    LicenseScanner,
    LicensedPackage,
    ProjectLicenses,
    LicenseAllowlist,
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

function licenseProblem(name: string, license: string, exception: LicenseException | undefined): string | undefined {
    if (exception === undefined) return `${name} reports ${license}, which is not an allowed license.`;
    if (exception.license === license) return undefined;
    return `${name} reports ${license}, and its exception names ${exception.license}; the exception no longer holds.`;
}

// Read through the files filesystem and verify the generated configuration against the selected policy.
function readAllowlist(input: CheckInput): LicenseAllowlist {
    const target = input.manifests.get('licenses')?.configs.find((config) => !config.fragment);
    if (target === undefined) throw new Error('The license configuration has no configuration target.');
    using files = openRoot(input.root);
    const content = files.read(targetInScope(input.scope, target));
    if (content === undefined)
        throw new Error('License configuration is missing. Run gspot apply before checking licenses.');
    const configuration: LicenseAllowlist = allowlistSchema.parse(JSON.parse(content.bytes.toString('utf8')));
    const tool = input.view.options('licenses');
    if (
        !isDeepStrictEqual(configuration, {
            allowed: tool['allowed'],
            exceptions: tool['exceptions'],
        })
    )
        throw new Error(
            'License configuration differs from the selected policy. Run gspot apply before checking licenses.',
        );
    return configuration;
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

const SCANNERS = new Map<string, LicenseScanner>([
    ['package.json', { scan: javascriptLicenses, packageKey: (name) => name }],
    ['pyproject.toml', { scan: pythonLicenses, packageKey: normalizedPythonIdentity }],
]);

/**
 * One finding for each installed package whose license is neither allowed nor covered by an exception that still holds.
 * @param input the check input
 * @returns the findings
 */
export async function licensesPackages(input: CheckInput): Promise<Finding[]> {
    if ((input.view.settings['licenses.allowed'] as string[]).length === 0) return [];
    const configuration = readAllowlist(input);
    const start = input.scopeRoot;
    const scans: ProjectLicenses[] = [];
    for (const [manifest, { scan, packageKey }] of SCANNERS) {
        if (statSync(join(start, manifest), { throwIfNoEntry: false }) === undefined) continue;
        const packages = await scan(input, start);
        scans.push({ manifest: input.scope === '' ? manifest : `${input.scope}/${manifest}`, packages, packageKey });
    }
    if (scans.length === 0) throw new Error('No supported dependency manifest is available for license scanning.');
    const allow = new Set(configuration.allowed);
    return scans.flatMap(({ manifest, packages, packageKey }) => {
        const exceptions = new Map(configuration.exceptions.map((entry) => [packageKey(entry.package), entry]));
        if (packages.length === 0)
            throw new Error(
                'The license scan found no packages. Install the selected project dependencies before scanning.',
            );
        return packages.flatMap(({ name, license }) => {
            const exception = exceptions.get(packageKey(name));
            if (exception === undefined && isAllowed(license, allow)) return [];
            const text = licenseProblem(name, license, exception);
            if (text === undefined) return [];
            return [findingAt(input, { file: manifest, line: 1 }, 'disallowed-license', text)];
        });
    });
}
