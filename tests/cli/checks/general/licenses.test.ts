import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { chmod, symlink, readFile } from 'node:fs/promises';
import { configurationManifests } from '#cli/configurations/public.ts';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';

import {
    SCANNERS,
    NPM_SCANNERS,
    LICENSE_SETTINGS,
    PROJECT_FINDINGS,
    SCANNER_FAILURES,
    LICENSE_EXCEPTIONS,
    UNUSED_LICENSE_FILES,
} from '#tests/config/cli/checks/general/licenses.ts';

/** Prepare real generated policy and a Python scanner version command before mocking scan output. */
async function preparePythonProject(root: string, settings: string = LICENSE_SETTINGS): Promise<void> {
    const scanner = process.platform === 'win32' ? SCANNERS.windows : SCANNERS.posix;
    const version = toolPin(configurationManifests().values(), 'pip-licenses').version!;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['licenses'], { tables: settings }),
        'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
        '.venv/installed': 'fixture',
        [scanner.path]: scanner.body.replace('VERSION', version),
    });
    await chmod(join(root, scanner.path), 0o755);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

test.each(
    ['', 'apps/example'].flatMap((scope) => [
        [scope, 'package.json', '{"name":"example","private":true}', 'node_modules'],
        [scope, 'pyproject.toml', '[project]\nname = "example"\nversion = "0.0.0"\n', '.venv'],
    ]),
)(
    'license scans in scope "%s" identify missing %s dependencies before starting scanners',
    async (scope, manifest, source, installed) => {
        await using sandbox = await testdir();
        const path = scope === '' ? manifest : `${scope}/${manifest}`;
        const tables =
            scope === '' ? LICENSE_SETTINGS : `${LICENSE_SETTINGS}[scope."${scope}"]\nconfigurations = ["licenses"]\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['licenses'], { tables }),
            [path]: source,
        });
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const input = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed', { scope });
        using spawn = spyOn(processes, 'run');
        expect(await rejection(BUILT_IN_CHECKS['licenses/allowed'].input(input))).toBe(
            `Install the project dependencies first: ${installed} is missing in ${scope === '' ? 'the root' : scope}.`,
        );
        expect(spawn).not.toHaveBeenCalled();
        expect(await pathExists(join(sandbox.path, scope, installed))).toBe(false);
    },
);

test.each(SCANNER_FAILURES)(
    'Python license scanning rejects $name and removes its temporary configuration directory',
    async ({ stdout, code, diagnostic }) => {
        await using sandbox = await testdir();
        await preparePythonProject(sandbox.path);
        await createFileTree(sandbox.path, {
            'app/pyproject.toml': '[project]\nname = "app"\nversion = "0.0.0"\n',
            'app/.venv/installed': 'installed',
        });
        const selected = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
        const directories: string[] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'run').mockImplementation((_argv, options) => {
                directories.push(options.cwd);
                return Promise.resolve(
                    directories.length === 1
                        ? {
                              code: 0,
                              missing: false,
                              stderr: '',
                              duration: 1,
                              stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]',
                          }
                        : { code, missing: false, stderr: 'sample diagnostic', duration: 1, stdout },
                );
            }),
        );
        expect(await rejection(BUILT_IN_CHECKS['licenses/allowed'].input(selected))).toContain(diagnostic);
        expect(directories.length).toBeGreaterThan(0);
        for (const directory of directories) {
            expect(directory).not.toBe(sandbox.path);
            expect(await pathExists(directory)).toBe(false);
        }
    },
);

test.each(UNUSED_LICENSE_FILES)(
    'a $name unused license file does not change the selected scanning policy',
    async ({ content }) => {
        await using sandbox = await testdir();
        await preparePythonProject(sandbox.path);
        const selected = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
        const path = join(sandbox.path, '.gspot/config/licenses.json');
        if (content !== undefined) await Bun.write(path, content);
        using spawn = spyOn(processes, 'run').mockResolvedValue({
            code: 0,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]',
        });
        expect(await BUILT_IN_CHECKS['licenses/allowed'].input(selected)).toStrictEqual([]);
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(await Bun.file(path).exists()).toBe(content !== undefined);
        if (content !== undefined) expect(await Bun.file(path).text()).toBe(content);
    },
);

test('an unused license file linked outside the repository does not change scanning or its destination', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await preparePythonProject(sandbox.path);
    const selected = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
    const path = join(sandbox.path, '.gspot/config/licenses.json');
    const original = '{"allowed":[],"exceptions":{}}';
    const destination = join(outside.path, 'configuration.json');
    await Bun.write(destination, original);
    await symlink(destination, path);
    using spawn = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        missing: false,
        duration: 1,
        stderr: '',
        stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]',
    });
    expect(await BUILT_IN_CHECKS['licenses/allowed'].input(selected)).toStrictEqual([]);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(await readFile(destination, 'utf8')).toBe(original);
});

test('combined license scans preserve manifest order, license alternatives, unknown licenses, and isolated Python settings', async () => {
    await using sandbox = await testdir();
    await preparePythonProject(
        sandbox.path,
        `${LICENSE_SETTINGS}[licenses.exceptions."choice@1.0.0"]\nlicense = "MIT OR GPL-3.0-only"\nreason = "Reviewed both installed license alternatives."\n[licenses.exceptions."Python_Package@2.0.0"]\nlicense = "GPL-3.0-only"\nreason = "Reviewed the installed Python package."\n`,
    );
    const scanner = process.platform === 'win32' ? NPM_SCANNERS.windows : NPM_SCANNERS.posix;
    const pin = toolPin(configurationManifests().values(), 'license-checker-rseidelsohn');
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true}',
        'node_modules/installed': 'fixture',
        [scanner.path]: scanner.body.replace('VERSION', pin.version!),
        '.gspot/node_modules/license-checker-rseidelsohn/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    await chmod(join(sandbox.path, scanner.path), 0o755);
    const selected = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
    const directories: string[] = [];
    using output = spyOn(processes, 'run').mockImplementation((command, options) => {
        directories.push(options.cwd);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(
                command[0]!.includes('license-checker-rseidelsohn')
                    ? {
                          'choice@1.0.0': { licenses: ['MIT', 'GPL-3.0-only'] },
                          'unknown@1.0.0': {},
                          'python.package@2.0.0': { licenses: 'GPL-3.0-only' },
                      }
                    : [
                          { Name: 'python-package', Version: '2.0.0', License: 'GPL-3.0-only' },
                          { Name: 'prohibited-python', Version: '2.0.0', License: 'GPL-3.0-only' },
                      ],
            ),
        });
    });
    const findings = await BUILT_IN_CHECKS['licenses/allowed'].input(selected);
    expect(findings).toMatchObject(
        PROJECT_FINDINGS.map(({ file, message }) => ({
            file,
            line: 1,
            rule: 'disallowed-license',
            message: textContaining(message),
        })),
    );
    expect(findings).toHaveLength(3);
    expect(output).toHaveBeenCalledTimes(2);
    expect(directories[0]).toBe(sandbox.path);
    const pythonDirectory = directories.find((directory) => directory !== sandbox.path);
    expect(pythonDirectory).toBeDefined();
    expect(await pathExists(pythonDirectory!)).toBe(false);
});

test.each(LICENSE_EXCEPTIONS)(
    'license matching preserves $name',
    async ({ license, package: name, exception, findings, installed = 'strict' }) => {
        await using sandbox = await testdir();
        await preparePythonProject(
            sandbox.path,
            `${LICENSE_SETTINGS}[licenses.exceptions."${name}"]\nlicense = "${exception}"\nreason = "Used at build time only, never shipped."\n`,
        );
        const selected = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'run').mockResolvedValue({
                code: 0,
                missing: false,
                duration: 1,
                stderr: '',
                stdout: JSON.stringify([{ Name: installed, Version: '1.0.0', License: license }]),
            }),
        );
        expect(await BUILT_IN_CHECKS['licenses/allowed'].input(selected)).toStrictEqual(
            findings.map(({ rule, diagnostic }) =>
                containing({
                    file: rule === 'stale-exception' ? 'gspot.toml' : 'pyproject.toml',
                    line: 1,
                    rule,
                    message: textContaining(diagnostic),
                }),
            ),
        );
    },
);
