import * as filesystem from 'node:fs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { DEPENDENCY_FILES_MESSAGE } from '#tests/config/messages.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { lstat, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

import {
    VALUE_ONE_LINE,
    TOOL_PROJECT_FILES,
    CRLF_PACKAGE_FILES,
    BIN_WORKSPACE_FILES,
    WORKSPACE_LOCK_FILES,
    DECLARATION_COPY_FILES,
    LOCKED_NPM_PROJECT_FILES,
    EXTERNAL_DEPENDENCY_FILES,
} from '#tests/config/runs/copy/dependencies.ts';

test('an index copy links installed packages and redirects workspace links into the copy', async () => {
    await using sandbox = await testdir(WORKSPACE_LOCK_FILES);

    await symlink('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'), 'dir');
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = await readFile(join(copy.root, 'node_modules/owned/value.js'), 'utf8');
    expect(await realpath(join(copy.root, 'node_modules/owned'))).toBe(
        await realpath(join(sandbox.path, 'packages/two/node_modules/owned')),
    );

    expect(copied).toBe('export const value = 2;');
    expect(await readFile(join(sandbox.path, 'packages/two/node_modules/owned/value.js'), 'utf8')).toBe(
        'export const value = 2;',
    );
    await unlink(join(sandbox.path, 'node_modules/owned'));
    await symlink(sandbox.path, join(sandbox.path, 'node_modules/owned'), 'dir');
    using workspace = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await realpath(join(workspace.root, 'node_modules/owned'))).toBe(await realpath(workspace.root));
});

test('a workspace bin into untracked build output is left out of the copy', async () => {
    await using sandbox = await testdir(BIN_WORKSPACE_FILES);

    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    await symlink('../packages/cli', join(sandbox.path, 'node_modules/cli'), 'dir');
    await symlink('../cli/dist/cli.js', join(sandbox.path, 'node_modules/.bin/cli'));
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const bin = await captureRejection(lstat(join(copy.root, 'node_modules/.bin/cli')));
    const copied = { package: await isOnDisk(join(copy.root, 'node_modules/cli/package.json')), bin };
    expect(copied).toMatchObject({ package: true, bin: { code: 'ENOENT' } });
});

test('an installed package links to the working tree and a dot folder stays out', async () => {
    await using sandbox = await testdir();
    await using external = await testdir();
    await createFileTree(sandbox.path, { ...EXTERNAL_DEPENDENCY_FILES, 'node_modules/.hidden/secret.txt': 'hidden' });
    await createFileTree(external.path, { 'package.json': '{}', 'private.txt': 'outside bytes' });
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    await symlink(external.path, join(sandbox.path, 'node_modules/external'));
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const location = join(copy.root, 'node_modules/external');
    const copied = {
        location,
        path: await realpath(location),
        text: await readFile(join(location, 'private.txt'), 'utf8'),
    };

    expect(await isOnDisk(join(copy.root, 'node_modules/.hidden'))).toBe(false);
    expect(copied.path).toBe(await realpath(external.path));
    expect(copied.text).toBe('outside bytes');
    await unlink(join(sandbox.path, 'node_modules/external'));
    using nextCopy = await copyRevision(sandbox.path, { kind: 'index' });
    const source = await readFile(join(nextCopy.root, 'node_modules/example/index.js'), 'utf8');
    expect(source).toBe(VALUE_ONE_LINE);
    expect(await readFile(join(external.path, 'private.txt'), 'utf8')).toBe('outside bytes');
});

test('a nested revision copy links each package of .gspot/node_modules', async () => {
    await using sandbox = await testdir(TOOL_PROJECT_FILES);

    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, 'project');
    using copy = await copyRevision(project, { kind: 'index' });
    const tools = await lstat(join(copy.root, GSPOT_PATHS.nodeModules, 'example'));
    const copied = {
        linked: tools.isSymbolicLink(),
        source: await readFile(join(copy.root, `${GSPOT_PATHS.nodeModules}/example/index.js`), 'utf8'),
    };
    expect(copied).toStrictEqual({ linked: true, source: VALUE_ONE_LINE });
});

test.each(['', 'nested/'])('revision copies link the installed Vale packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}${GSPOT_PATHS.valeConfigFile}`;
    const packagePath = `${GSPOT_PATHS.valePackages}/Example/rule.yml`;
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../../../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': `${GSPOT_PATHS.valePackages}/\n`,
    });
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = join(copy.root, packagePath);
    const source = await readFile(copied, 'utf8');
    expect(await realpath(join(copy.root, GSPOT_PATHS.valePackages))).toBe(
        await realpath(join(sandbox.path, GSPOT_PATHS.valePackages)),
    );

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
        'pyproject.toml': '[project]\nname = "sample"\nversion = "0.0.0"\n',
        'source.py': 'selected = True\n',
        'uv.lock': 'version = 1\n',
        '.venv/pyvenv.cfg': `home = ${sandbox.path}\nversion_info = 3.12.2\n`,
        '.venv/bin/python': 'interpreter',
    });
    runGitStep(root, ['init']);
    runGitStep(root, ['add', '.']);
    using copy = await copyRevision(root, { kind: 'index' });
    const copied = {
        environment: await isOnDisk(join(copy.root, '.venv')),
        source: await readFile(join(copy.root, 'source.py'), 'utf8'),
    };
    expect(copied).toStrictEqual({ environment: false, source: 'selected = True\n' });
    expect(await readFile(join(root, '.venv/bin/python'), 'utf8')).toBe('interpreter');
    await writeFile(join(root, 'uv.lock'), 'version = 2\n');
    using changed = await copyRevision(root, { kind: 'index' });
    expect(changed.dependencyNote).toBe(DEPENDENCY_FILES_MESSAGE);
});

test('cancellation waits for the dependency copies to finish before removing the copy and keeps installed files', async () => {
    await using sandbox = await testdir(LOCKED_NPM_PROJECT_FILES);

    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    const controller = new AbortController();
    const previous = filesystem.symlinkSync;
    let destination: string | undefined;
    using _copy = spyOn(filesystem, 'symlinkSync').mockImplementation((target, path, type) => {
        destination = dirname(String(path));
        previous(target, path, type);
        controller.abort(new Error('Canceled dependency copy'));
    });

    const cancelError = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }, controller.signal));
    expect(cancelError.message).toBe('Canceled dependency copy');
    expect(await isOnDisk(destination!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
        'export const value = 2;\n',
    );
});

test('a package.json checked out with CRLF matches its LF blob in the index copy when Git converts line endings', async () => {
    await using sandbox = await createGitSandbox(CRLF_PACKAGE_FILES);

    runGitStep(sandbox.path, ['config', 'core.autocrlf', 'true']);
    runGitStep(sandbox.path, ['add', '.']);
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "crlf"\r\n}\r\n');
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const source = await readFile(join(copy.root, 'node_modules/example/index.js'), 'utf8');
    expect(source).toBe(VALUE_ONE_LINE);
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    using changed = await copyRevision(sandbox.path, { kind: 'index' });
    expect(changed.dependencyNote).toBe(DEPENDENCY_FILES_MESSAGE);
    expect(await readFile(join(changed.root, 'node_modules/example/index.js'), 'utf8')).toBe(VALUE_ONE_LINE);
});

test('changed compiler settings omit declaration copies and leave a dependency note', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': 'types/\n',
        'tsconfig.json': '{"extends":"./compiler.json","include":["types/**/*.d.ts"]}',
        'compiler.json': '{"compilerOptions":{"strict":true}}',
        'types/generated.d.ts': 'declare const generated: string;',
    });
    runGitStep(sandbox.path, ['add', '.']);
    await writeFile(join(sandbox.path, 'tsconfig.json'), '{broken');
    using broken = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await isOnDisk(join(broken.root, 'types/generated.d.ts'))).toBe(false);
    expect(broken.dependencyNote).toBeDefined();
    runGitStep(sandbox.path, ['checkout', '--', 'tsconfig.json']);
    await writeFile(join(sandbox.path, 'compiler.json'), '{"compilerOptions":{"strict":false}}');
    using changed = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await isOnDisk(join(changed.root, 'types/generated.d.ts'))).toBe(false);
    expect(changed.dependencyNote).toBeDefined();
});

test('an index copy clones an ignored declaration file that a tsconfig includes, and nothing outside the repository', async () => {
    await using sandbox = await testdir(DECLARATION_COPY_FILES);
    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init']);
    runGitStep(root, ['add', '.']);
    using copy = await copyRevision(root, { kind: 'index' });
    expect(await readFile(join(copy.root, 'types/generated.d.ts'), 'utf8')).toBe('declare const generated: string;\n');
    expect(await readFile(join(copy.root, 'types/kept.d.ts'), 'utf8')).toBe('declare const kept: number;\n');
    expect(await isOnDisk(join(copy.root, 'outside.d.ts'))).toBe(false);
});

test('an index copy clones the ignored build output that a package.json names in files', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"lib","files":["dist"]}',
        '.gitignore': 'dist/\n',
        'dist/index.js': 'export const built = 1;\n',
    });
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await readFile(join(copy.root, 'dist/index.js'), 'utf8')).toBe('export const built = 1;\n');
    await writeFile(join(sandbox.path, 'package.json'), '{"name":"lib"}');
    runGitStep(sandbox.path, ['add', 'package.json']);
    using withoutFiles = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await isOnDisk(join(withoutFiles.root, 'dist/index.js'))).toBe(false);
});

test('a revision refuses installed dependencies without a committed lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'app/package.json': '{}',
        '.gitignore': 'node_modules/\n',
        'app/node_modules/example/index.js': 'export const value = 1;',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const error = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }));
    expect(error).toMatchObject({
        code: 'copy',
        message:
            'app has no lockfile, so gspot cannot tell whether its installed dependencies match this revision. Commit a lockfile.',
    });
});

test('a revision refuses tracked installed dependencies', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{}',
        'bun.lock': '{}',
        'node_modules/example/index.js': 'export const value = 1;',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const error = await captureRejection(copyRevision(sandbox.path, { kind: 'index' }));
    expect(error).toMatchObject({
        code: 'copy',
        message: 'Installed dependencies are tracked in the selected revision. Untrack them before checking again.',
    });
});
