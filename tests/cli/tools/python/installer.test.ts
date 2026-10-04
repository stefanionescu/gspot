import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { UV_MISE_PIN } from '#cli/config/tools/python.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { InstalledOutput } from '#cli/types/tools/install.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { installPythonProject, preparePythonProject } from '#cli/tools/python/project.ts';
import { AUTHORED_UV_INDEX, PRIVATE_PYTHON_LOCK, PRIVATE_PYTHON_PROJECT } from '#tests/config/samples/python/tools.ts';

test('one command acquires its pinned uv once and resolves locks through that executable', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['python'], { tables: 'run_with = "mise"\n[agent_rules]\nenabled = false\n' }),
        'main.py': 'print("authored")\n',
    });
    const session = await openSession(repository.path);
    const executable = join(repository.path, 'pinned-uv');
    const calls: string[][] = [];
    const run = processes.run;
    const boundary = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise' && command[0] !== executable) return run(command, options);
        calls.push([...command]);
        if (command[0] === executable) writeFileSync(join(options.cwd, 'uv.lock'), PRIVATE_PYTHON_LOCK);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 0,
            stdout: command[1] === 'which' ? executable : '',
            stderr: '',
        });
    });
    try {
        expect(await Promise.all([session.pythonInstaller(), session.pythonInstaller()])).toStrictEqual([
            executable,
            executable,
        ]);
        const files: GeneratedFile[] = [
            { path: '.gspot/pyproject.toml', content: PRIVATE_PYTHON_PROJECT, readOnly: true, kind: 'config' },
        ];
        {
            using log = openOwnership(repository.path);
            await preparePythonProject(session, files, log.files, { refreshLocks: false });
        }
        expect(calls.slice(0, 2)).toStrictEqual([
            ['mise', 'install', UV_MISE_PIN],
            ['mise', 'which', 'uv', '--tool', UV_MISE_PIN],
        ]);
        expect(calls).toHaveLength(3);
        expect(calls[2]).toContain('--no-python-downloads');
        expect(calls[2]!.slice(0, 2)).toStrictEqual([executable, 'lock']);
        expect(files[1]).toMatchObject({ path: '.gspot/uv.lock', content: PRIVATE_PYTHON_LOCK, kind: 'lock' });
        expect(existsSync(join(repository.path, '.gspot/uv.lock'))).toBe(false);
    } finally {
        boundary.mockRestore();
    }
});

test.each(['venv', 'sync'])(
    'failed uv %s is repairable and preserves authored inputs with redacted output',
    async (step) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
            '.gspot/uv.lock': PRIVATE_PYTHON_LOCK,
            'uv.toml': AUTHORED_UV_INDEX,
        });
        const run = processes.run;
        const calls: string[][] = [];
        const boundary = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'unavailable-uv') return run(command, options);
            calls.push([...command]);
            return Promise.resolve({
                code: command[1] === step ? 7 : 0,
                missing: false,
                duration: 0,
                stdout: 'index password test%2Bpassword test+password',
                stderr: 'interpreter unavailable',
            });
        });
        try {
            let diagnosticError: unknown;
            {
                using log = openOwnership(repository.path);
                const staged: InstalledOutput[][] = [];
                diagnosticError = await installPythonProject(
                    repository.path,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, outputs) => {
                            staged.push(outputs);
                        },
                    },
                    'unavailable-uv',
                ).catch((error: unknown) => error);
                expect(staged).toStrictEqual([]);
            }
            expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
            const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
            expect(diagnostic).toContain(`UV ${step} failed (exit 7)`);
            expect(diagnostic).toContain('Python 3.11 or newer');
            expect(diagnostic).toContain('interpreter unavailable');
            expect(diagnostic).toContain('run: gspot install');
            expect(diagnostic).not.toContain('test%2Bpassword');
            expect(diagnostic).not.toContain('test+password');
            expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
            expect(readFileSync(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PRIVATE_PYTHON_LOCK);
            expect(readFileSync(join(repository.path, 'uv.toml'), 'utf8')).toBe(AUTHORED_UV_INDEX);
            expect(existsSync(join(repository.path, '.gspot/.venv'))).toBe(false);
        } finally {
            boundary.mockRestore();
        }
    },
);

test('a successful uv operation refuses a password in its temporary lock and preserves managed inputs', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
        '.gspot/uv.lock': PRIVATE_PYTHON_LOCK,
        'uv.toml': AUTHORED_UV_INDEX,
    });
    const run = processes.run;
    using boundary = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'synthetic-uv') return run(command, options);
        writeFileSync(join(options.cwd, 'uv.lock'), `${PRIVATE_PYTHON_LOCK}\n# test+password\n`);
        return Promise.resolve({ code: 0, missing: false, duration: 0, stdout: '', stderr: '' });
    });
    let diagnosticError: unknown;
    {
        using log = openOwnership(repository.path);
        const staged: InstalledOutput[][] = [];
        diagnosticError = await installPythonProject(
            repository.path,
            {
                read: log.files.read.bind(log.files),
                installTree: (_kind, outputs) => {
                    staged.push(outputs);
                },
            },
            'synthetic-uv',
        ).catch((error: unknown) => error);
        expect(staged).toStrictEqual([]);
    }
    expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(diagnosticError instanceof Error ? diagnosticError.message : '').toBe(
        'The uv lock includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(readFileSync(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PRIVATE_PYTHON_LOCK);
    expect(readFileSync(join(repository.path, 'uv.toml'), 'utf8')).toBe(AUTHORED_UV_INDEX);
    expect(existsSync(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});
