import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeNpmTool } from '#tests/setup/fakes.ts';
import * as processes from '#cli/system/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { prepareLicenseSandbox } from '#tests/setup/licenses.ts';
import { matchFields, matchSubstring, captureRejection } from '#tests/setup/matchers.ts';

import {
    LICENSE_SETTINGS,
    SCANNER_FAILURES,
    NPM_LICENSE_REPORT,
    ALLOWED_PACKAGE_CASES,
    PYTHON_LICENSE_REPORT,
    SCAN_ALLOWED_PACKAGES,
    EXPECTED_SCAN_FINDINGS,
    LICENSE_DEPENDENCY_FILES,
    ALLOWED_PACKAGE_SCOPE_CASES,
} from '#tests/data/checks/licenses.ts';

test.each([...ALLOWED_PACKAGE_SCOPE_CASES])('allowed-packages: allowed packages: $name', async (scenario) => {
    const { scopes, reports, findings } = scenario;
    await using sandbox = await testdir();
    await prepareLicenseSandbox(sandbox.path, scenario);

    const scanned: string[] = [];
    using output = spyOn(processes, 'spawnProcess').mockImplementation((command) => {
        const interpreter = command.at(-1)!;
        const [scope, identity] = Object.entries(reports).find(
            ([entry]) => interpreter === buildVenvExecutablePath(join(sandbox.path, entry, '.venv'), 'python'),
        )!;
        scanned.push(scope);
        const [name, version] = identity.split('@');
        return Promise.resolve(
            buildProcessResult({
                stdout: JSON.stringify([
                    {
                        Name: name,
                        Version: version,
                        License: 'MIT',
                    },
                ]),
            }),
        );
    });
    expect(await checkFindings(sandbox.path, 'licenses/allowed')).toStrictEqual(
        findings.map(({ file, rule, message }) => matchFields({ file, rule, message: matchSubstring(message) })),
    );
    const expected = scopes
        .filter((scope) => scope !== ('ignore' in scenario ? scenario.ignore : undefined))
        .toSorted((a, b) => a.localeCompare(b));
    expect(scanned.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(expected);
    expect(output).toHaveBeenCalledTimes(expected.length);
});

test.each([...ALLOWED_PACKAGE_CASES])('allowed-packages: an allowed package: $name', async (sample) => {
    const { license, package: name, findings } = sample;
    const installed = 'installed' in sample ? sample.installed : 'strict';
    await using sandbox = await testdir();
    await prepareLicenseSandbox(
        sandbox.path,
        `${LICENSE_SETTINGS}[[licenses.allowed_package]]\nname = "${name.slice(0, name.lastIndexOf('@'))}"\nversion = "${name.slice(name.lastIndexOf('@') + 1)}"\nreason = "Reviewed the published GPL license."\n`,
    );

    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({
                stdout: JSON.stringify([{ Name: installed, Version: '1.0.0', License: license }]),
            }),
        ),
    );
    expect(await checkFindings(sandbox.path, 'licenses/allowed')).toStrictEqual(
        findings.map(({ rule, message }) =>
            matchFields({
                file: rule === 'unused-record' ? 'gspot.toml' : 'pyproject.toml',
                line: 1,
                rule,
                message: matchSubstring(message),
            }),
        ),
    );
});
test.each(['', 'apps/example'].flatMap((scope) => LICENSE_DEPENDENCY_FILES.map((row) => [scope, ...row])))(
    'scan: a scan in scope "%s" stops before any scanner when %s dependencies are not installed',
    async (scope, manifest, source, installed) => {
        await using sandbox = await testdir();
        const path = scope === '' ? manifest : `${scope}/${manifest}`;
        const tables =
            scope === ''
                ? LICENSE_SETTINGS
                : `${LICENSE_SETTINGS}[[scope]]\npath = "${scope}"\nconfigurations = ["licenses"]\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['licenses'], { tables }),
            [path]: source,
        });

        using spawn = spyOn(processes, 'spawnProcess');
        expect(await captureRejection(checkFindings(sandbox.path, 'licenses/allowed'))).toBe(
            `Install the project dependencies first: ${installed} is missing in ${scope === '' ? 'the root' : scope}.`,
        );
        expect(spawn).not.toHaveBeenCalled();
        expect(await isOnDisk(join(sandbox.path, scope, installed))).toBe(false);
    },
);

test.each([...SCANNER_FAILURES])(
    'scan: pip-licenses $name is an error and its scratch folder is deleted',
    async ({ stdout, code, message }) => {
        await using sandbox = await testdir();
        await prepareLicenseSandbox(sandbox.path);
        await createFileTree(sandbox.path, {
            'app/pyproject.toml': '[project]\nname = "app"\nversion = "0.0.0"\n',
            'app/.venv/installed': 'installed',
        });

        const folders: string[] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'spawnProcess').mockImplementation((_argv, options) => {
                folders.push(options.cwd);
                return Promise.resolve(
                    folders.length === 1
                        ? buildProcessResult({ stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]' })
                        : buildProcessResult({ code, stderr: 'sample diagnostic', stdout }),
                );
            }),
        );
        expect(await captureRejection(checkFindings(sandbox.path, 'licenses/allowed'))).toContain(message);
        expect(folders.length).toBeGreaterThan(0);
        for (const folder of folders) {
            expect(folder).not.toBe(sandbox.path);
            expect(await isOnDisk(folder)).toBe(false);
        }
    },
);

test('scan: one scan reads package.json and pyproject.toml, accepts a license choice, and reports unknown licenses', async () => {
    await using sandbox = await testdir();
    await prepareLicenseSandbox(sandbox.path, LICENSE_SETTINGS + SCAN_ALLOWED_PACKAGES);
    await fakeNpmTool(sandbox.path, 'license-checker-rseidelsohn');
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"dependencies":{"choice":"1.0.0"}}',
        'node_modules/installed': 'sample',
    });

    const folders: string[] = [];
    const nativeRun = processes.spawnProcess;
    using output = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'git') return nativeRun(command, options);
        folders.push(options.cwd);
        return Promise.resolve(
            buildProcessResult({
                stdout: JSON.stringify(
                    command.some((argument) => argument.includes('license-checker-rseidelsohn'))
                        ? NPM_LICENSE_REPORT
                        : PYTHON_LICENSE_REPORT,
                ),
            }),
        );
    });
    const findings = await checkFindings(sandbox.path, 'licenses/allowed');
    expect(findings).toMatchObject(
        EXPECTED_SCAN_FINDINGS.map(({ file, message }) => ({
            file,
            line: 1,
            rule: 'disallowed-license',
            message: matchSubstring(message),
        })),
    );
    expect(output).toHaveBeenCalledTimes(2);
    expect(folders[0]).toBe(sandbox.path);
    const pythonFolder = folders.find((folder) => folder !== sandbox.path);
    expect(pythonFolder).toBeDefined();
    expect(await isOnDisk(pythonFolder!)).toBe(false);
});
