import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { emitAll } from '#cli/generation/render.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { licensesPackages } from '#cli/checks/licenses.ts';
import { chmodSync, existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { rejection } from '#tests/support/rejection.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
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
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
        'package.json': '{"name":"example","private":true}',
    });
    expect((await rejection(licensesPackages(await input(sandbox.path)))).message).toBe(
        'Dependency licenses cannot be checked before installing the project dependencies.',
    );
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
            directories.push(options.cwd);
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
