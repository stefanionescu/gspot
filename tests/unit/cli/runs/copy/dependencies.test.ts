import { join, dirname } from 'node:path';
import * as promises from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { lstat, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

/** Stages dependency declarations and authored files for a revision copy. */
function stageRevision(root: string): void {
    readGitOutput(root, ['init']);
    readGitOutput(root, ['add', '.']);
}

/** Reads the error from a revision that must refuse its dependency state. */
async function captureRevisionFailure(root: string): Promise<string> {
    return await captureRejection(copyRevision(root, { kind: 'index' }));
}

test('staged copies copy every workspace dependency tree before checking links between them', async () => {
    await using sandbox = await testdir({
        'package.json': '{"workspaces":["packages/*"]}',
        'bun.lock': '{}',
        'packages/one/package.json': '{"name":"one"}',
        'packages/two/package.json': '{"name":"two"}',
        'node_modules/root/value.js': 'export const value = 1;',
        'packages/two/node_modules/owned/value.js': 'export const value = 2;',
        '.gitignore': 'node_modules/\n',
    });

    await symlink('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'), 'dir');
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = await readFile(join(copy.root, 'node_modules/owned/value.js'), 'utf8');
    await writeFile(join(copy.root, 'node_modules/owned/value.js'), 'copy change');

    expect(copied).toContain('value = 2');
    expect(await readFile(join(sandbox.path, 'packages/two/node_modules/owned/value.js'), 'utf8')).toContain(
        'value = 2',
    );
    await unlink(join(sandbox.path, 'node_modules/owned'));
    await symlink(sandbox.path, join(sandbox.path, 'node_modules/owned'), 'dir');
    expect(await captureRevisionFailure(sandbox.path)).toContain(
        `Installed dependency link ${join('node_modules', 'owned')} points to this repository or a parent folder.`,
    );
});

test('a workspace bin into untracked build output is left out of the copy', async () => {
    await using sandbox = await testdir({
        'package.json': '{"workspaces":["packages/*"]}',
        'bun.lock': '{}',
        'packages/cli/package.json': '{"name":"cli","bin":{"cli":"dist/cli.js"}}',
        'packages/cli/dist/cli.js': 'console.log(1);',
        '.gitignore': 'node_modules/\ndist/\n',
    });

    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    await symlink('../packages/cli', join(sandbox.path, 'node_modules/cli'), 'dir');
    await symlink('../cli/dist/cli.js', join(sandbox.path, 'node_modules/.bin/cli'));
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const bin = await lstat(join(copy.root, 'node_modules/.bin/cli')).catch((error: unknown) => error);
    const copied = { package: await isOnDisk(join(copy.root, 'node_modules/cli/package.json')), bin };
    expect(copied).toMatchObject({ package: true, bin: { code: 'ENOENT' } });
});

test('a revision copy clones external dependencies instead of linking them', async () => {
    await using sandbox = await testdir();
    await using external = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{}',
        'bun.lock': '{}',
        '.gitignore': 'node_modules/\n',
        'node_modules/example/index.js': 'export const value = 1;',
    });
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
    expect(source).toContain('value = 1');
    expect(await readFile(join(external.path, 'private.txt'), 'utf8')).toBe('outside bytes');
});

test('a nested revision copy links .gspot/node_modules instead of copying it', async () => {
    await using sandbox = await testdir({
        'project/.gspot/package.json': '{}',
        'project/.gspot/bun.lock': '{}',
        'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
        '.gitignore': 'node_modules/\n.gspot/state/\n',
    });

    stageRevision(sandbox.path);
    const project = join(sandbox.path, 'project');
    // The private tools run in place, so the copy links them instead of copying them.
    using copy = await copyRevision(project, { kind: 'index' });
    const tools = await lstat(join(copy.root, '.gspot/node_modules'));
    const copied = {
        linked: tools.isSymbolicLink(),
        source: await readFile(join(copy.root, '.gspot/node_modules/example/index.js'), 'utf8'),
    };
    expect(copied).toStrictEqual({ linked: true, source: 'export const value = 1;' });
});

test.each(['', 'nested/'])('revision copies reuse the installed Vale packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/configurations/general/prose/vale.ini`;
    const packagePath = '.gspot/vale/Example/rule.yml';
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../../../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': '.gspot/vale/\n',
    });
    stageRevision(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copied = join(copy.root, packagePath);
    const source = await readFile(copied, 'utf8');
    await writeFile(copied, 'copy-only edit');

    expect(source).toBe('extends: existence\n');
    expect(await readFile(join(sandbox.path, packagePath), 'utf8')).toBe('extends: existence\n');
    await writeFile(join(sandbox.path, config), 'Packages = Different\n');
    expect(await captureRevisionFailure(sandbox.path)).toContain('do not match the revision configuration');
});

test('a copy leaves the virtual environment in the working tree and still checks its lockfile', async () => {
    await using repository = await testdir();
    const root = join(repository.path, "an author's project");
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
        'source.py': 'selected = True\n',
        'uv.lock': 'version = 1\n',
        '.venv/pyvenv.cfg': `home = ${repository.path}\nversion_info = 3.12.2\n`,
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
    expect(await captureRevisionFailure(root)).toContain('do not match the dependency files');
});

test('cancellation drains dependency copies before removing the copy and keeps installed files', async () => {
    await using sandbox = await testdir({
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"fixture","version":"1.0.0"}\n',
        'package-lock.json': '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
        'source.js': 'export const value = 1;\n',
        'node_modules/item-0/value.js': 'export const value = 2;\n',
    });

    stageRevision(sandbox.path);
    const controller = new AbortController();
    const original = promises.cp;
    let pending = 0;
    let destination: string | undefined;
    using _copy = spyOn(promises, 'cp').mockImplementation(async (...copyArguments) => {
        pending += 1;
        // The copied node_modules folder sits one level below the scratch root.
        if (typeof copyArguments[1] === 'string') destination = dirname(copyArguments[1]);
        try {
            await original(...copyArguments);
            controller.abort(new Error('Canceled dependency copy'));
        } finally {
            pending -= 1;
        }
    });

    expect(await captureRejection(copyRevision(sandbox.path, { kind: 'index' }, controller.signal))).toContain(
        'Canceled dependency copy',
    );
    expect(pending).toBe(0);
    expect(destination).toBeDefined();
    expect(await isOnDisk(destination!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
        'export const value = 2;\n',
    );
});

test('a manifest checked out with CRLF matches its LF blob when Git converts line endings', async () => {
    await using sandbox = await testdir({
        'package.json': '{\n    "name": "crlf"\n}\n',
        'bun.lock': '{}\n',
        '.gitignore': 'node_modules/\n',
        'node_modules/example/index.js': 'export const value = 1;',
    });

    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['config', 'core.autocrlf', 'true']);
    readGitOutput(sandbox.path, ['add', '.']);
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "crlf"\r\n}\r\n');
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    const source = await readFile(join(copy.root, 'node_modules/example/index.js'), 'utf8');
    expect(source).toContain('value = 1');
    await writeFile(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    expect(await captureRevisionFailure(sandbox.path)).toContain('do not match the dependency files');
});
