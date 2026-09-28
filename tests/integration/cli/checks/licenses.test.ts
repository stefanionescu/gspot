import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import * as tools from '#cli/execution/tool/runner.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { licensesPackages } from '#cli/checks/licenses.ts';
import { rejection } from '#tests/support/expectations.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import { chmodSync, existsSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';

// The pinned scanner as the private environment holds it: a shell script on POSIX, a command file on Windows.
const SCANNER =
    process.platform === 'win32'
        ? { path: '.gspot/.venv/Scripts/pip-licenses.cmd', body: '@echo pip-licenses 5.5.5\r\n' }
        : { path: '.gspot/.venv/bin/pip-licenses', body: '#!/bin/sh\nprintf "pip-licenses 5.5.5\\n"\n' };

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/licenses.json')))
        await Bun.write(join(root, file.path), file.content);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'licenses/packages')!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

test('license analysis refuses absent dependencies instead of reporting a successful scan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT"]\n',
        'package.json': '{"name":"example","private":true}',
    });
    expect(await rejection(licensesPackages(await input(sandbox.path)))).toBe(
        'Dependency licenses cannot be checked before installing the project dependencies.',
    );
});

test.each([
    ['malformed JSON', '{', 0],
    ['missing version', '[{"Name":"example","License":"MIT"}]', 0],
    ['missing license', '[{"Name":"example","Version":"1.0.0"}]', 0],
    ['empty report', '[]', 0],
    ['scanner failure', '[]', 1],
] as const)(
    'Python license scanning rejects %s and removes its temporary configuration directory',
    async (_failure, stdout, code) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT"]\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            '.venv/installed': 'fixture',
            [SCANNER.path]: SCANNER.body,
        });
        chmodSync(join(sandbox.path, SCANNER.path), 0o755);
        const selected = await input(sandbox.path);
        let broken = true;
        const directories: string[] = [];
        const spawn = spyOn(processes, 'run').mockImplementation((_argv, options) => {
            directories.push(options.cwd);
            return Promise.resolve({
                code: broken ? code : 0,
                missing: false,
                stderr: 'fixture diagnostic',
                duration: 1,
                stdout: broken ? stdout : '[{"Name":"example","Version":"1.0.0","License":"MIT"}]',
            });
        });
        try {
            await rejection(licensesPackages(selected));
            expect(directories.every((directory) => !existsSync(directory))).toBe(true);
            broken = false;
            expect(await licensesPackages(selected)).toStrictEqual([]);
            expect(directories.every((directory) => !existsSync(directory))).toBe(true);
        } finally {
            spawn.mockRestore();
        }
    },
);

test.each(['missing', 'malformed', 'stale', 'external link'])(
    'license configuration %s is refused before scanning and corrected bytes restore execution',
    async (failure) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT"]\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            '.venv/installed': 'fixture',
            [SCANNER.path]: SCANNER.body,
        });
        chmodSync(join(sandbox.path, SCANNER.path), 0o755);
        const selected = await input(sandbox.path);
        const path = join(sandbox.path, '.gspot/config/licenses.json');
        const original = readFileSync(path);
        if (failure === 'missing') unlinkSync(path);
        else if (failure === 'external link') {
            await Bun.write(join(outside.path, 'configuration.json'), original);
            unlinkSync(path);
            symlinkSync(join(outside.path, 'configuration.json'), path);
        } else await Bun.write(path, failure === 'malformed' ? '{' : '{"licenses_allowed":[],"packages_allowed":[]}');
        const spawn = spyOn(processes, 'run').mockResolvedValue({
            code: 0,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: '[{"Name":"example","Version":"1.0.0","License":"MIT"}]',
        });
        try {
            await rejection(licensesPackages(selected));
            expect(spawn).not.toHaveBeenCalled();
            // A linked configuration outside the repository is never written.
            expect(
                failure !== 'external link' || readFileSync(join(outside.path, 'configuration.json')).equals(original),
            ).toBe(true);
            if (failure === 'external link') {
                unlinkSync(path);
            }
            await Bun.write(path, original);
            expect(await licensesPackages(selected)).toStrictEqual([]);
            expect(spawn).toHaveBeenCalledTimes(1);
        } finally {
            spawn.mockRestore();
        }
    },
);

test('combined license scans preserve manifest order, license alternatives, and unknown licenses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT"]\n',
        'package.json': '{"name":"example","private":true}',
        'node_modules/installed': 'fixture',
        'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
        '.venv/installed': 'fixture',
    });
    const selected = await input(sandbox.path);
    const commands: string[][] = [];
    const directories: string[] = [];
    const spawn = spyOn(tools, 'runCheckCommand').mockImplementation((_input, command, options) => {
        commands.push(command);
        directories.push(options.cwd);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(
                command.includes('--start')
                    ? { 'choice@1.0.0': { licenses: ['MIT', 'GPL-3.0-only'] }, 'unknown@1.0.0': {} }
                    : [{ Name: 'python-package', Version: '2.0.0', License: 'GPL-3.0-only' }],
            ),
        });
    });
    try {
        const findings = await licensesPackages(selected);
        expect(findings.map(({ file, message: diagnostic }) => ({ file, message: diagnostic }))).toStrictEqual([
            { file: 'package.json', message: 'unknown@1.0.0 reports UNKNOWN, which is not an allowed license.' },
            {
                file: 'pyproject.toml',
                message: 'python-package@2.0.0 reports GPL-3.0-only, which is not an allowed license.',
            },
        ]);
        expect(commands).toHaveLength(2);
        expect(commands[0]).toContain('--start');
        expect(commands[1]).toContain('--with-system');
        expect(directories[0]).toBe(sandbox.path);
        expect(directories[1]).not.toBe(sandbox.path);
        expect(existsSync(directories[1]!)).toBe(false);
    } finally {
        spawn.mockRestore();
    }
});
