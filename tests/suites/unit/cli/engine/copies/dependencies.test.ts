import { existsSync } from 'node:fs';
import * as filesystem from 'node:fs';
import { lstat, mkdir, readFile, realpath, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { DEPENDENCY_REVISION_NOTE } from '#cli/config/engine.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { copyDependencies } from '#cli/engine/copies/dependencies.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import {
    BIN_WORKSPACE_FILES,
    CRLF_PACKAGE_FILES,
    DECLARATION_COPY_FILES,
    EXTERNAL_DEPENDENCY_FILES,
    LOCKED_NPM_PROJECT_FILES,
    TOOL_PROJECT_FILES,
    VALUE_ONE_LINE,
    WORKSPACE_LOCK_FILES,
} from '#tests/config/engine/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

test('an index copy links installed packages and redirects workspace links into the copy', async () => {
    await using sandbox = await testdir(WORKSPACE_LOCK_FILES);

    await symlink('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'), 'dir');
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await realpath(join(copy.root, 'node_modules/owned'))).toBe(
        await realpath(join(sandbox.path, 'packages/two/node_modules/owned')),
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
    const copied = { package: existsSync(join(copy.root, 'node_modules/cli/package.json')), bin };
    expect(copied).toMatchObject({ package: true, bin: { code: 'ENOENT' } });
});

test('a dot folder of node_modules reaches the copy only when it holds an install of its own', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...EXTERNAL_DEPENDENCY_FILES,
        'node_modules/.cache/entry.txt': 'cache',
        'node_modules/.tools/node_modules/tool/index.d.ts': 'export declare const tool: number;',
    });
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });

    expect(existsSync(join(copy.root, 'node_modules/.cache'))).toBe(false);
    expect(await realpath(join(copy.root, 'node_modules/.tools/node_modules/tool'))).toBe(
        await realpath(join(sandbox.path, 'node_modules/.tools/node_modules/tool')),
    );
});

test.skipIf(!isWindows)(
    'a Windows dependency copy links folders and copies executable files without file symlinks',
    async () => {
        await using sandbox = await testdir({
            'source/node_modules/package/index.js': 'export {};',
            'target/.keep': '',
        });
        const root = join(sandbox.path, 'source');
        const target = join(sandbox.path, 'target');
        const names = ['eslint.cmd', 'eslint.ps1', 'eslint.exe'];
        await createFileTree(root, Object.fromEntries(names.map((name) => [`node_modules/.bin/${name}`, name])));
        await copyDependencies({ root, target, dependencies: ['node_modules'] });
        const packageStats = await lstat(join(target, 'node_modules/package'));
        expect(packageStats.isSymbolicLink()).toBe(true);
        expect(await realpath(join(target, 'node_modules/package'))).toBe(
            await realpath(join(root, 'node_modules/package')),
        );
        for (const name of names) {
            const copied = join(target, 'node_modules/.bin', name);
            const copiedStats = await lstat(copied);
            expect(copiedStats.isFile()).toBe(true);
            expect(await readFile(copied, 'utf8')).toBe(name);
        }
    },
);

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

test('revision copies link the installed Vale packages', async () => {
    await using sandbox = await testdir();
    const config = GSPOT_PATHS.valeConfig;
    const packagePath = `${GSPOT_PATHS.valePackages}/Example/rule.yml`;
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': `${GSPOT_PATHS.valePackages}/\n`,
    });
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await realpath(join(copy.root, GSPOT_PATHS.valePackages))).toBe(
        await realpath(join(sandbox.path, GSPOT_PATHS.valePackages)),
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
        environment: existsSync(join(copy.root, '.venv')),
        source: await readFile(join(copy.root, 'source.py'), 'utf8'),
    };
    expect(copied).toStrictEqual({ environment: false, source: 'selected = True\n' });
    await writeFile(join(root, 'uv.lock'), 'version = 2\n');
    using changed = await copyRevision(root, { kind: 'index' });
    expect(changed.dependencyNote).toBe(DEPENDENCY_REVISION_NOTE);
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
    expect(existsSync(destination!)).toBe(false);
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
    expect(copy.dependencyNote).toBeUndefined();
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    using changed = await copyRevision(sandbox.path, { kind: 'index' });
    expect(changed.dependencyNote).toBe(DEPENDENCY_REVISION_NOTE);
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
    expect(existsSync(join(broken.root, 'types/generated.d.ts'))).toBe(false);
    expect(broken.dependencyNote).toBe(DEPENDENCY_REVISION_NOTE);
    runGitStep(sandbox.path, ['checkout', '--', 'tsconfig.json']);
    await writeFile(join(sandbox.path, 'compiler.json'), '{"compilerOptions":{"strict":false}}');
    using changed = await copyRevision(sandbox.path, { kind: 'index' });
    expect(existsSync(join(changed.root, 'types/generated.d.ts'))).toBe(false);
    expect(changed.dependencyNote).toBe(DEPENDENCY_REVISION_NOTE);
});

test('an index copy clones an ignored declaration file that a tsconfig includes, and nothing outside the repository', async () => {
    await using sandbox = await testdir(DECLARATION_COPY_FILES);
    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init']);
    runGitStep(root, ['add', '.']);
    using copy = await copyRevision(root, { kind: 'index' });
    expect(await readFile(join(copy.root, 'types/generated.d.ts'), 'utf8')).toBe('declare const generated: string;\n');
    expect(existsSync(join(copy.root, 'outside.d.ts'))).toBe(false);
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
    expect(existsSync(join(withoutFiles.root, 'dist/index.js'))).toBe(false);
});

test('a copy keeps tracked dependencies as the revision holds them', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': 'app/node_modules/\n',
        'app/package.json': '{}',
        'app/node_modules/ignored/index.js': 'export const value = 1;',
        'package.json': '{}',
        'node_modules/tracked/index.js': 'export const value = 2;',
    });
    runGitStep(sandbox.path, ['add', '.']);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const tracked = await lstat(join(copy.root, 'node_modules/tracked/index.js'));
    expect(tracked.isSymbolicLink()).toBe(false);
});
