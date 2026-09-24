import { z } from 'zod';
// Installed dependency licenses, compared with the allowlist and exact-version exceptions.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import satisfies from 'spdx-satisfies';
import { isDeepStrictEqual } from 'node:util';
import parseExpression from 'spdx-expression-parse';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/run/engines.ts';
import { statSync, mkdtempSync, rmSync } from 'node:fs';
import { targetInScope } from '#cli/run/scope-paths.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { normalizedPythonPackage } from '#cli/repository/python-package.ts';

export type LicenseException = z.infer<typeof configurationSchema>['packages_allowed'][number];

const TOOL = 'license-checker-rseidelsohn';
const licenseSchema = z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() });
const reportSchema = z.record(z.string(), licenseSchema);
const pythonReportSchema = z.array(
    z.object({ Name: z.string().min(1), Version: z.string().min(1), License: z.string().min(1) }),
);
const configurationSchema = z.object({
    licenses_allowed: z.array(z.string().min(1)),
    packages_allowed: z.array(
        z.strictObject({ package: z.string().min(1), license: z.string().min(1), reason: z.string().min(1) }),
    ),
});

// A license expression passes when every part of a conjunction, or one part of a choice, is allowed.
function isAllowed(license: string, allow: Set<string>): boolean {
    try {
        parseExpression(license);
    } catch {
        return false;
    }
    return satisfies(license, [...allow]);
}

function reported(entry: z.infer<typeof licenseSchema>): string {
    return Array.isArray(entry.licenses) ? entry.licenses.join(' OR ') : (entry.licenses ?? 'UNKNOWN');
}

function verdict(name: string, license: string, exception: LicenseException | undefined): string | undefined {
    if (exception === undefined) return `${name} reports ${license}, which is not an allowed license.`;
    if (exception.license === license) return undefined;
    return `${name} reports ${license}, and its exception names ${exception.license}; the exception no longer holds.`;
}

/**
 * One finding for each installed package whose license is neither allowed nor covered by an exception that still holds.
 * @param input the engine input
 * @returns the findings
 */
export async function licensesPackages(input: EngineInput): Promise<Finding[]> {
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
    const start = join(input.root, input.scope);
    const scans: { manifest: string; packages: { name: string; license: string }[] }[] = [];
    for (const manifest of ['package.json', 'pyproject.toml']) {
        if (statSync(join(start, manifest), { throwIfNoEntry: false }) === undefined) continue;
        const python = manifest === 'pyproject.toml';
        const installed = join(start, python ? '.venv' : 'node_modules');
        if (statSync(installed, { throwIfNoEntry: false })?.isDirectory() !== true)
            throw new Error('Dependency licenses cannot be checked before installing the project dependencies.');
        const isolated = python ? mkdtempSync(join(tmpdir(), 'gspot-licenses-')) : undefined;
        try {
            const command = python
                ? [
                      'pip-licenses',
                      '--format=json',
                      '--with-system',
                      '--from=mixed',
                      '--python',
                      join(installed, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
                  ]
                : [TOOL, '--json', '--excludePrivatePackages', '--start', start];
            const result = await runCheckCommand(input, command, { cwd: isolated ?? start });
            if (result.code !== 0)
                throw new Error(`${command[0]} did not run: ${result.stderr.trim().split('\n', 1)[0] ?? ''}`);
            const report: unknown = JSON.parse(result.stdout);
            const packages = python
                ? pythonReportSchema
                      .parse(report)
                      .map((entry) => ({ name: `${entry.Name}@${entry.Version}`, license: entry.License }))
                : Object.entries(reportSchema.parse(report)).map(([name, entry]) => ({
                      name,
                      license: reported(entry),
                  }));
            scans.push({ manifest: input.scope === '' ? manifest : `${input.scope}/${manifest}`, packages });
        } finally {
            if (isolated !== undefined) rmSync(isolated, { recursive: true, force: true });
        }
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
        const finding = (rule: string, text: string): Finding => ({
            check: input.spec.name,
            file: manifest,
            line: 1,
            rule,
            message: text,
            fixable: false,
        });
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
            return text === undefined ? [] : [finding('license', text)];
        });
    });
}
