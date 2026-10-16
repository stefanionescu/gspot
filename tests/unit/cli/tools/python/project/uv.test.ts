import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInstallContext } from '#tests/setup/install.ts';
import { installPythonTools, preparePythonLockfile } from '#cli/tools/python/project.ts';
import { UV_TOML, PYTHON_TOOL_PROJECT, PYTHON_TOOL_LOCKFILE } from '#tests/config/python/tool-project.ts';

test.each(['venv', 'sync'])('a failed uv %s can be repaired and hides index passwords', async (step) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': settingsText([]),
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
    using log = openWriter(repository.path);
    const diagnosticError: unknown = await installPythonTools(
        buildInstallContext(await openSession(repository.path), log),
        'unavailable-uv',
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
        'gspot.toml': settingsText([]),
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT,
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE,
        'uv.toml': UV_TOML,
    });
    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${PYTHON_TOOL_LOCKFILE}\n# test+password\n`);
        return { code: 0, missing: false, duration: 0, stdout: '', stderr: '' };
    });
    using log = openWriter(repository.path);
    const session = await openSession(repository.path);
    session.uvPath = 'synthetic-uv';
    const read = log.files.read.bind(log.files);
    using _read = spyOn(log.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    const diagnosticError: unknown = await preparePythonLockfile(buildInstallContext(session, log), {
        path: '.gspot/pyproject.toml',
        content: PYTHON_TOOL_PROJECT,
        kind: 'tool_file',
    }).catch((error: unknown) => error);
    expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(diagnosticError instanceof Error ? diagnosticError.message : '').toBe(
        'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await pathExists(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});
