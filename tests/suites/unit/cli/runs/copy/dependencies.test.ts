import { join, dirname } from 'node:path';
import * as promises from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { lstat, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

import {
    TOOL_PROJECT_FILES,
    CRLF_PACKAGE_FILES,
    BIN_WORKSPACE_FILES,
    WORKSPACE_LOCK_FILES,
    LOCKED_NPM_PROJECT_FILES,
    EXTERNAL_DEPENDENCY_FILES,
} from '#tests/config/runs/copy/dependencies.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in this file share it.
function stageRevision(root: string): void {
    runGitStep(root, ['init']);
    runGitStep(root, ['add', '.']);
}

test('an index copy copies every workspace dependency tree before it checks the links between them', async () => {
    await using sandbox = await testdir(WORKSPACE_LOCK_FILES);

    await symlink('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'), 'dir');
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = await readFile(join(copy.root, 'node_modules/owned/value.js'), 'utf8');
    await writeFile(join(copy.root, 'node_modules/owned/value.js'), 'copy change');

    expect(copied).toBe('export const value = 2;');
    expect(await readFile(join(sandbox.path, 'packages/two/node_modules/owned/value.js'), 'utf8')).toBe(
        'export const value = 2;',
    );
    await unlink(join(sandbox.path, 'node_modules/owned'));
    await symlink(sandbox.path, join(sandbox.path, 'node_modules/owned'), 'dir');
    const copyRevisionError = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }));
    expect(copyRevisionError.message).toBe(
        `Installed dependency link ${join('node_modules', 'owned')} points to this repository or a parent folder. Check this commit in its own clone after installing its project dependencies there.`,
    );
});

test('a workspace bin into untracked build output is left out of the copy', async () => {
    await using sandbox = await testdir(BIN_WORKSPACE_FILES);

    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    await symlink('../packages/cli', join(sandbox.path, 'node_modules/cli'), 'dir');
    await symlink('../cli/dist/cli.js', join(sandbox.path, 'node_modules/.bin/cli'));
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const bin = await captureRejection(lstat(join(copy.root, 'node_modules/.bin/cli')));
    const copied = { package: await isOnDisk(join(copy.root, 'node_modules/cli/package.json')), bin };
    expect(copied).toMatchObject({ package: true, bin: { code: 'ENOENT' } });
});

test('a revision copy clones external dependencies instead of linking them', async () => {
    await using sandbox = await testdir();
    await using external = await testdir();
    await createFileTree(sandbox.path, EXTERNAL_DEPENDENCY_FILES);
    await createFileTree(external.path, { 'package.json': '{}', 'private.txt': 'outside bytes' });
    stageRevision(sandbox.path);
    await symlink(external.path, join(sandbox.path, 'node_modules/external'));
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const location = join(copy.root, 'node_modules/external');
    const copied = {
        location,
        path: await realpath(location),
        text: await readFile(join(location, 'private.txt'), 'utf8'),
    };
    await writeFile(join(location, 'private.txt'), 'private correction');

    expect(copied.path).toBe(copied.location);
    expect(copied.text).toBe('outside bytes');
    await unlink(join(sandbox.path, 'node_modules/external'));
    using nextCopy = await copyRevision(sandbox.path, { kind: 'index' });
    const source = await readFile(join(nextCopy.root, 'node_modules/example/index.js'), 'utf8');
    expect(source).toBe('export const value = 1;');
    expect(await readFile(join(external.path, 'private.txt'), 'utf8')).toBe('outside bytes');
});

test('a nested revision copy links .gspot/node_modules instead of copying it', async () => {
    await using sandbox = await testdir(TOOL_PROJECT_FILES);

    stageRevision(sandbox.path);
    const project = join(sandbox.path, 'project');
    using copy = await copyRevision(project, { kind: 'index' });
    const tools = await lstat(join(copy.root, GSPOT_PATHS.nodeModules));
    const copied = {
        linked: tools.isSymbolicLink(),
        source: await readFile(join(copy.root, `${GSPOT_PATHS.nodeModules}/example/index.js`), 'utf8'),
    };
    expect(copied).toStrictEqual({ linked: true, source: 'export const value = 1;' });
});

test.each(['', 'nested/'])('revision copies reuse the installed Vale packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}${GSPOT_PATHS.valeConfigFile}`;
    const packagePath = `${GSPOT_PATHS.valePackages}/Example/rule.yml`;
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../../../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': `${GSPOT_PATHS.valePackages}/\n`,
    });
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = join(copy.root, packagePath);
    const source = await readFile(copied, 'utf8');
    await writeFile(copied, 'copy-only edit');

    expect(source).toBe('extends: existence\n');
    expect(await readFile(join(sandbox.path, packagePath), 'utf8')).toBe('extends: existence\n');
    await writeFile(join(sandbox.path, config), 'Packages = Different\n');
    const valeError = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }));
    expect(valeError.message).toBe(
        'The installed Vale packages do not match the Vale settings of this revision. Check this commit in its own clone after running gspot apply and gspot install there.',
    );
});

test('a copy leaves the virtual environment in the working tree and still checks its lockfile', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, "an author's project");
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
        'source.py': 'selected = True\n',
        'uv.lock': 'version = 1\n',
        '.venv/pyvenv.cfg': `home = ${sandbox.path}\nversion_info = 3.12.2\n`,
        '.venv/bin/python': 'interpreter',
    });
    stageRevision(root);
    using copy = await copyRevision(root, { kind: 'index' });
    const copied = {
        environment: await isOnDisk(join(copy.root, '.venv')),
        source: await readFile(join(copy.root, 'source.py'), 'utf8'),
    };
    expect(copied).toStrictEqual({ environment: false, source: 'selected = True\n' });
    expect(await readFile(join(root, '.venv/bin/python'), 'utf8')).toBe('interpreter');
    await writeFile(join(root, 'uv.lock'), 'version = 2\n');
    using changed = await copyRevision(root, { kind: 'index' });
    expect(changed.dependencyNote).toBe(
        'The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.',
    );
});

test('cancellation waits for the dependency copies to finish before removing the copy and keeps installed files', async () => {
    await using sandbox = await testdir(LOCKED_NPM_PROJECT_FILES);

    stageRevision(sandbox.path);
    const controller = new AbortController();
    const original = promises.cp;
    let pending = 0;
    let destination: string | undefined;
    using _copy = spyOn(promises, 'cp').mockImplementation(async (...copyArguments) => {
        pending += 1;
        if (typeof copyArguments[1] === 'string') destination = dirname(copyArguments[1]);
        try {
            await original(...copyArguments);
            controller.abort(new Error('Canceled dependency copy'));
        } finally {
            pending -= 1;
        }
    });

    const cancelError = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }, controller.signal));
    expect(cancelError.message).toBe('Canceled dependency copy');
    expect(pending).toBe(0);
    expect(await isOnDisk(destination!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
        'export const value = 2;\n',
    );
});

test('a package.json checked out with CRLF matches its LF blob in the index copy when Git converts line endings', async () => {
    await using sandbox = await testdir(CRLF_PACKAGE_FILES);

    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['config', 'core.autocrlf', 'true']);
    runGitStep(sandbox.path, ['add', '.']);
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "crlf"\r\n}\r\n');
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const source = await readFile(join(copy.root, 'node_modules/example/index.js'), 'utf8');
    expect(source).toBe('export const value = 1;');
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    using changed = await copyRevision(sandbox.path, { kind: 'index' });
    expect(changed.dependencyNote).toBe(
        'The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.',
    );
    expect(await readFile(join(changed.root, 'node_modules/example/index.js'), 'utf8')).toBe('export const value = 1;');
});
