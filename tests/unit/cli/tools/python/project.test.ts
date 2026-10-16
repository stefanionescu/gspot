import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakeTool, fakeCommand } from '#tests/setup/fakes.ts';
import { buildInstallContext } from '#tests/setup/install.ts';
import { PYTHON_VERSION } from '#cli/config/parsers/dependency-files.ts';
import { installPythonTools, preparePythonLockfile } from '#cli/tools/python/project.ts';

import {
    UV_TOML,
    LEAKED_UV_INDEX,
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
} from '#tests/data/tools/python-tool-project.ts';

/** Resolve the selected Python version in the shared installed-project arrangement. */
function pythonProjectFiles(): Record<string, string> {
    return {
        'gspot.toml': buildSettingsText([]),
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
        'uv.toml': UV_TOML,
    };
}

test.each(['venv', 'sync'])('a failed uv %s can be repaired and hides index passwords', async (step) => {
    await using repository = await testdir();
    await createFileTree(repository.path, pythonProjectFiles());
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
    const installError: unknown = await installPythonTools(
        buildInstallContext(await openSession(repository.path), log),
        'unavailable-uv',
    ).catch((error: unknown) => error);
    expect(installError).toMatchObject({ name: 'GspotError', code: 'installation' });
    const message = installError instanceof Error ? installError.message : String(installError);
    expect(message).toContain(`UV ${step} failed (exit 7)`);
    expect(message).toContain('Check Python downloads and index settings, then run: gspot install.');
    expect(message).toContain('interpreter unavailable');
    expect(message).toContain('run: gspot install');
    expect(message).not.toContain('test%2Bpassword');
    expect(message).not.toContain('test+password');
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(
        PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
    );
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, pythonProjectFiles());
    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(
            join(options.cwd, 'uv.lock'),
            `${PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION)}\n# test+password\n`,
        );
        return { code: 0, missing: false, duration: 0, stdout: '', stderr: '' };
    });
    using log = openWriter(repository.path);
    const session = await openSession(repository.path);
    session.uvPath = 'synthetic-uv';
    const read = log.files.read.bind(log.files);
    using _read = spyOn(log.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    const lockfileError: unknown = await preparePythonLockfile(buildInstallContext(session, log), {
        path: '.gspot/pyproject.toml',
        content: PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
        kind: 'tool_file',
    }).catch((error: unknown) => error);
    expect(lockfileError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(lockfileError instanceof Error ? lockfileError.message : '').toBe(
        'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(
        PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
    );
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('a uv that copies index credentials into the lockfile is refused and the lockfile is kept', async () => {
    await using repository = await testdir({
        'gspot.toml': buildSettingsText(['python']),
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
        'uv.toml': LEAKED_UV_INDEX,
    });
    await using artifacts = await testdir();
    const root = repository.path;
    const bin = await fakeTool(
        artifacts.path,
        'bin/uv',
        String.raw`const fs = require('node:fs'); fs.writeFileSync('uv.lock', '# synthetic-uv-password\n');`,
    );
    using log = openWriter(root);
    const session = await openSession(root);
    const manifest = {
        path: '.gspot/pyproject.toml',
        content: PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
    };
    session.uvPath = join(bin, isWindows ? 'uv.cmd' : 'uv');
    const read = log.files.read.bind(log.files);
    using _boundary = spyOn(log.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    expect(await captureRejection(preparePythonLockfile(buildInstallContext(session, log), manifest))).toContain(
        'includes repository index credentials',
    );
    expect(await Bun.file(join(root, '.gspot/uv.lock')).text()).toBe(
        PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
    );
});
