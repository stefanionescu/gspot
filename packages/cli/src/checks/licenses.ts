import { z } from 'zod';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import satisfies from 'spdx-satisfies';
import { isDeepStrictEqual } from 'node:util';
import parseExpression from 'spdx-expression-parse';
import { statSync, mkdtempSync, rmSync } from 'node:fs';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { targetInScope } from '#cli/configurations/targets.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { LICENSE_CHECKER_TOOL } from '#cli/constants/checks/checks.ts';
import { normalizedPythonPackage } from '#cli/repository/manifests.ts';
import type { LicenseException, LicensedPackage, EngineInput, Finding } from '#cli/types/checks/checks.ts';

const licenseSchema = z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() });
const reportSchema = z.record(z.string(), licenseSchema);
const pythonReportSchema = z.array(
    z.object({ Name: z.string().min(1), Version: z.string().min(1), License: z.string().min(1) }),
);
// A license expression passes when every part of a conjunction, or one part of a choice, is allowed.
function isAllowed(license: string, allow: Set<string>): boolean {
    try {
        parseExpression(license);
    } catch {
        return false;
    }
    return satisfies(license, [...allow]);
}

function verdict(name: string, license: string, exception: LicenseException | undefined): string | undefined {
    if (exception === undefined) return `${name} reports ${license}, which is not an allowed license.`;
    if (exception.license === license) return undefined;
    return `${name} reports ${license}, and its exception names ${exception.license}; the exception no longer holds.`;
}

// Read through the confined filesystem and verify the generated configuration against the selected policy.
function readConfiguration(input: EngineInput): z.infer<typeof configurationSchema> {
    const target = input.manifests.get('licenses')?.configs.find((config) => !config.fragment);
    if (target === undefined) throw new Error('The license configuration has no configuration target.');
    const files = openConfinedRoot(input.root);
    let configuration: z.infer<typeof configurationSchema>;
    try {
        const content = files.read(targetInScope(input.scope, target));
        if (content === undefined)
            throw new Error('License configuration is missing. Run gspot apply before checking licenses.');
        configuration = configurationSchema.parse(JSON.parse(content.bytes.toString('utf8')));
    } finally {
        files.close();
    }
    const tool = input.view.tool('licenses');
    if (
        !isDeepStrictEqual(configuration, {
            licenses_allowed: tool['licenses_allowed'],
            packages_allowed: tool['packages_allowed'],
        })
    )
        throw new Error(
            'License configuration differs from the selected policy. Run gspot apply before checking licenses.',
        );
    return configuration;
}

function installedDirectory(start: string, name: string): string {
    const installed = join(start, name);
    if (statSync(installed, { throwIfNoEntry: false })?.isDirectory() !== true)
        throw new Error('Dependency licenses cannot be checked before installing the project dependencies.');
    return installed;
}

async function licenseReport(input: EngineInput, command: string[], cwd: string): Promise<unknown> {
    const result = await runCheckCommand(input, command, { cwd });
    if (result.code !== 0)
        throw new Error(`${command.join(' ')} did not run: ${result.stderr.trim().split('\n', 1)[0] ?? ''}`);
    return JSON.parse(result.stdout);
}

async function javascriptLicenses(input: EngineInput, start: string): Promise<LicensedPackage[]> {
    installedDirectory(start, 'node_modules');
    const report = await licenseReport(
        input,
        [LICENSE_CHECKER_TOOL, '--json', '--excludePrivatePackages', '--start', start],
        start,
    );
    return Object.entries(reportSchema.parse(report)).map(([name, entry]) => ({
        name,
        license: Array.isArray(entry.licenses) ? entry.licenses.join(' OR ') : (entry.licenses ?? 'UNKNOWN'),
    }));
}

// Run outside the project so project-owned scanner settings cannot hide installed dependencies.
async function pythonLicenses(input: EngineInput, start: string): Promise<LicensedPackage[]> {
    const installed = installedDirectory(start, '.venv');
    const isolated = mkdtempSync(join(tmpdir(), 'gspot-licenses-'));
    try {
        const report = await licenseReport(
            input,
            [
                'pip-licenses',
                '--format=json',
                '--with-system',
                '--from=mixed',
                '--python',
                join(installed, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
            ],
            isolated,
        );
        return pythonReportSchema
            .parse(report)
            .map((entry) => ({ name: `${entry.Name}@${entry.Version}`, license: entry.License }));
    } finally {
        rmSync(isolated, { recursive: true, force: true });
    }
}

const SCANNERS = new Map<string, (input: EngineInput, start: string) => Promise<LicensedPackage[]>>([
    ['package.json', javascriptLicenses],
    ['pyproject.toml', pythonLicenses],
]);

export const configurationSchema = z.object({
    licenses_allowed: z.array(z.string().min(1)),
    packages_allowed: z.array(
        z.strictObject({ package: z.string().min(1), license: z.string().min(1), reason: z.string().min(1) }),
    ),
});

/**
 * One finding for each installed package whose license is neither allowed nor covered by an exception that still holds.
 * @param input the engine input
 * @returns the findings
 */
export async function licensesPackages(input: EngineInput): Promise<Finding[]> {
    if ((input.view.settings['tools.licenses.licenses_allowed'] as string[]).length === 0) return [];
    const configuration = readConfiguration(input);
    const start = join(input.root, input.scope);
    const scans: { manifest: string; packages: LicensedPackage[] }[] = [];
    for (const [manifest, scan] of SCANNERS) {
        if (statSync(join(start, manifest), { throwIfNoEntry: false }) === undefined) continue;
        const packages = await scan(input, start);
        scans.push({ manifest: input.scope === '' ? manifest : `${input.scope}/${manifest}`, packages });
    }
    if (scans.length === 0) throw new Error('No supported dependency manifest is available for license scanning.');
    const allow = new Set(configuration.licenses_allowed);
    const exceptions = new Map(configuration.packages_allowed.map((entry) => [entry.package, entry]));
    const pythonExceptions = new Map(
        configuration.packages_allowed.map((entry) => [
            entry.package.replace(/^[^@]+(?=@)/u, normalizedPythonPackage),
            entry,
        ]),
    );
    return scans.flatMap(({ manifest, packages }) => {
        if (packages.length === 0)
            throw new Error(
                'The license scan found no packages. Install the selected project dependencies before scanning.',
            );
        return packages.flatMap(({ name, license }) => {
            const exception = manifest.endsWith('pyproject.toml')
                ? pythonExceptions.get(name.replace(/^[^@]+(?=@)/u, normalizedPythonPackage))
                : exceptions.get(name);
            if (exception === undefined && isAllowed(license, allow)) return [];
            const text = verdict(name, license, exception);
            if (text === undefined) return [];
            return [
                { check: input.spec.name, file: manifest, line: 1, rule: 'license', message: text, fixable: false },
            ];
        });
    });
}
