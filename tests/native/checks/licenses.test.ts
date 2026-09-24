import { engineInput } from '#cli/run/engines.ts';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import * as processes from '#cli/platform/spawn.ts';
import { chmodSync, existsSync, readFileSync, unlinkSync, symlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { licensesPackages } from '#cli/checks/licenses.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import type { EngineInput } from '#cli/types/execution.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    for (const file of emitAll(session).files.filter(({ path }) => path.endsWith('/licenses.json')))
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
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
        'package.json': '{"name":"example","private":true}',
    });
    await rejects(licensesPackages(await input(sandbox.path)), {
        message: 'Dependency licenses cannot be checked before installing the project dependencies.',
    });
});

test('native Python license scanning ignores project scanner exclusions and verifies exact reported exceptions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
        'pyproject.toml':
            '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
    });
    for (const command of [
        ['uv', 'venv', '.venv'],
        ['uv', 'venv', '.gspot/.venv'],
        ['uv', 'pip', 'install', '--python', '.gspot/.venv/bin/python', 'pip-licenses==5.5.5'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const location = await run(
        [join(root, '.venv/bin/python'), '-I', '-c', 'import sysconfig; print(sysconfig.get_path("purelib"))'],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
    const writeLicense = async (license: string): Promise<void> => {
        await Bun.write(
            metadata,
            `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: ${license}\n`,
        );
    };
    await writeLicense('GPL-3.0-only');
    expect(await licensesPackages(await input(root))).toEqual([
        expect.objectContaining({
            file: 'pyproject.toml',
            rule: 'license',
            message: expect.stringContaining('licensed-example@1.0.0 reports GPL-3.0-only'),
        }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        'version = 1\nconfigurations = ["licenses"]\n[[tools.licenses.packages_allowed]]\npackage = "Licensed._Example@1.0.0"\nlicense = "GPL-3.0-only"\nreason = "Fixture tests exact reported license consent."\n',
    );
    expect(await licensesPackages(await input(root))).toEqual([]);
    await writeLicense('MIT');
    expect(await licensesPackages(await input(root))).toEqual([
        expect.objectContaining({ rule: 'license', message: expect.stringContaining('exception no longer holds') }),
    ]);
    await Bun.write(join(root, 'gspot.toml'), 'version = 1\nconfigurations = ["licenses"]\n');
    expect(await licensesPackages(await input(root))).toEqual([]);
    await writeLicense('MIT-0');
    expect(await licensesPackages(await input(root))).toEqual([
        expect.objectContaining({ message: expect.stringContaining('reports MIT-0, which is not an allowed license') }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT-0"]\n',
    );
    expect(await licensesPackages(await input(root))).toEqual([]);
});

test.each(['malformed JSON', 'missing version', 'missing license', 'empty report', 'scanner failure'])(
    'Python license scanning rejects %s and removes its temporary configuration directory',
    async (failure) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            '.venv/installed': 'fixture',
            '.gspot/.venv/bin/pip-licenses': '#!/bin/sh\nprintf "pip-licenses 5.5.5\\n"\n',
        });
        chmodSync(join(sandbox.path, '.gspot/.venv/bin/pip-licenses'), 0o755);
        const selected = await input(sandbox.path);
        let broken = true;
        const directories: string[] = [];
        const spawn = spyOn(processes, 'run').mockImplementation(async (_argv, options) => {
            directories.push(options!.cwd!);
            const report = { Name: 'example', Version: '1.0.0', License: 'MIT' };
            const values = broken && failure === 'empty report' ? [] : [report];
            if (broken && failure === 'missing version') Reflect.deleteProperty(report, 'Version');
            if (broken && failure === 'missing license') Reflect.deleteProperty(report, 'License');
            return {
                code: broken && failure === 'scanner failure' ? 1 : 0,
                missing: false,
                stderr: 'fixture diagnostic',
                duration: 1,
                stdout: broken && failure === 'malformed JSON' ? '{' : JSON.stringify(values),
            };
        });
        try {
            await expect(licensesPackages(selected)).rejects.toThrow();
            expect(directories.every((directory) => !existsSync(directory))).toBe(true);
            broken = false;
            expect(await licensesPackages(selected)).toEqual([]);
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
            'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            '.venv/installed': 'fixture',
            '.gspot/.venv/bin/pip-licenses': '#!/bin/sh\nprintf "pip-licenses 5.5.5\\n"\n',
        });
        chmodSync(join(sandbox.path, '.gspot/.venv/bin/pip-licenses'), 0o755);
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
            await expect(licensesPackages(selected)).rejects.toThrow();
            expect(spawn).not.toHaveBeenCalled();
            if (failure === 'external link') {
                expect(readFileSync(join(outside.path, 'configuration.json'))).toEqual(original);
                unlinkSync(path);
            }
            await Bun.write(path, original);
            expect(await licensesPackages(selected)).toEqual([]);
            expect(spawn).toHaveBeenCalledTimes(1);
        } finally {
            spawn.mockRestore();
        }
    },
);
