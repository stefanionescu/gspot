import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { fakeNpmTool } from '#tests/setup/fake-tool.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { prepareLicenseSandbox } from '#tests/setup/licenses.ts';
import { rejection, textContaining } from '#tests/setup/matchers.ts';

import {
    LICENSE_SETTINGS,
    SCANNER_FAILURES,
    LICENSE_MANIFESTS,
    NPM_LICENSE_REPORT,
    SCAN_ALLOWED_PACKAGES,
    PYTHON_LICENSE_REPORT,
    EXPECTED_SCAN_FINDINGS,
} from '#tests/config/licenses.ts';

test.each(['', 'apps/example'].flatMap((scope) => LICENSE_MANIFESTS.map((row) => [scope, ...row])))(
    'a scan in scope "%s" stops before any scanner when %s dependencies are not installed',
    async (scope, manifest, source, installed) => {
        await using sandbox = await testdir();
        const path = scope === '' ? manifest : `${scope}/${manifest}`;
        const tables =
            scope === ''
                ? LICENSE_SETTINGS
                : `${LICENSE_SETTINGS}[[scope]]\npath = "${scope}"\nconfigurations = ["licenses"]\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['licenses'], { tables }),
            [path]: source,
        });

        using spawn = spyOn(processes, 'spawnProcess');
        expect(await rejection(checkFindings(sandbox.path, 'licenses/allowed'))).toBe(
            `Install the project dependencies first: ${installed} is missing in ${scope === '' ? 'the root' : scope}.`,
        );
        expect(spawn).not.toHaveBeenCalled();
        expect(await pathExists(join(sandbox.path, scope, installed))).toBe(false);
    },
);

test.each([...SCANNER_FAILURES])(
    'pip-licenses $name is an error and its scratch folder is deleted',
    async ({ stdout, code, diagnostic }) => {
        await using sandbox = await testdir();
        await prepareLicenseSandbox(sandbox.path);
        await createFileTree(sandbox.path, {
            'app/pyproject.toml': '[project]\nname = "app"\nversion = "0.0.0"\n',
            'app/.venv/installed': 'installed',
        });

        const directories: string[] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'spawnProcess').mockImplementation((_argv, options) => {
                directories.push(options.cwd);
                return Promise.resolve(
                    directories.length === 1
                        ? processResult({ stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]' })
                        : processResult({ code, stderr: 'sample diagnostic', stdout }),
                );
            }),
        );
        expect(await rejection(checkFindings(sandbox.path, 'licenses/allowed'))).toContain(diagnostic);
        expect(directories.length).toBeGreaterThan(0);
        for (const directory of directories) {
            expect(directory).not.toBe(sandbox.path);
            expect(await pathExists(directory)).toBe(false);
        }
    },
);

test('one scan reads package.json and pyproject.toml, accepts a license choice, and reports unknown licenses', async () => {
    await using sandbox = await testdir();
    await prepareLicenseSandbox(sandbox.path, LICENSE_SETTINGS + SCAN_ALLOWED_PACKAGES);
    await fakeNpmTool(sandbox.path, 'license-checker-rseidelsohn');
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"dependencies":{"choice":"1.0.0"}}',
        'node_modules/installed': 'sample',
    });

    const directories: string[] = [];
    const nativeRun = processes.spawnProcess;
    using output = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'git') return nativeRun(command, options);
        directories.push(options.cwd);
        return Promise.resolve(
            processResult({
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
            message: textContaining(message),
        })),
    );
    expect(output).toHaveBeenCalledTimes(2);
    expect(directories[0]).toBe(sandbox.path);
    const pythonDirectory = directories.find((directory) => directory !== sandbox.path);
    expect(pythonDirectory).toBeDefined();
    expect(await pathExists(pythonDirectory!)).toBe(false);
});
