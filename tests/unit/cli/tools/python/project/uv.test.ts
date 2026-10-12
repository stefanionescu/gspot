import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeCommand } from '#tests/setup/processes.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { installPythonTools, preparePythonLockfile } from '#cli/tools/python/project.ts';
import { UV_TOML, PYTHON_TOOL_PROJECT, PYTHON_TOOL_LOCKFILE } from '#tests/config/python/tool-project.ts';

test.each(['venv', 'sync'])('a failed uv %s can be repaired and hides index passwords', async (step) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT,
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE,
        'uv.toml': UV_TOML,
    });
    const calls: string[][] = [];
    using _boundary = fakeCommand('unavailable-uv', (command) => {
        calls.push([...command]);
        return Promise.resolve({
            code: command[1] === step ? 7 : 0,
            missing: false,
            duration: 0,
            stdout: 'index password test%2Bpassword test+password',
            stderr: 'interpreter unavailable',
        });
    });
    using log = openOwnershipLog(repository.path);
    const diagnosticError: unknown = await installPythonTools(
        repository.path,
        log.files,
        'unavailable-uv',
        undefined,
        rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        [],
    ).catch((error: unknown) => error);
    expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
    const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
    expect(diagnostic).toContain(`UV ${step} failed (exit 7)`);
    expect(diagnostic).toContain('Check Python downloads and index settings, then run: gspot install.');
    expect(diagnostic).toContain('interpreter unavailable');
    expect(diagnostic).toContain('run: gspot install');
    expect(diagnostic).not.toContain('test%2Bpassword');
    expect(diagnostic).not.toContain('test+password');
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await pathExists(join(repository.path, '.gspot/.venv'))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT,
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE,
        'uv.toml': UV_TOML,
    });
    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${PYTHON_TOOL_LOCKFILE}\n# test+password\n`);
        return { code: 0, missing: false, duration: 0, stdout: '', stderr: '' };
    });
    using log = openOwnershipLog(repository.path);
    const diagnosticError: unknown = await preparePythonLockfile(
        { path: '.gspot/pyproject.toml', content: PYTHON_TOOL_PROJECT, kind: 'tool_file' },
        { read: (path) => (path === '.gspot/uv.lock' ? undefined : log.files.read(path)) },
        {
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            root: repository.path,
            uvPath: 'synthetic-uv',
            cancelSignal: undefined,
        },
        [],
    ).catch((error: unknown) => error);
    expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(diagnosticError instanceof Error ? diagnosticError.message : '').toBe(
        'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await pathExists(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});
