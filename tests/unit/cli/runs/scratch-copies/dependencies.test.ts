import { join, dirname } from 'node:path';
import * as promises from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { copyRevision } from '#cli/checks/run/copy/revision.ts';
import { lstat, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

/** Stages dependency declarations and authored files for a revision copy. */
function stageRevision(root: string): void {
    readGitOutput(root, ['init']);
    readGitOutput(root, ['add', '.']);
}

/** Reads the error from a revision that must refuse its dependency state. */
async function captureRevisionFailure(root: string): Promise<string> {
    return await captureRejection(copyRevision(root, { kind: 'index' }, () => Promise.resolve(undefined)));
}

test('staged copies copy every workspace dependency tree before checking links between them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    const copied = await copyRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const source = await Bun.file(join(copy, 'node_modules/owned/value.js')).text();
        await Bun.write(join(copy, 'node_modules/owned/value.js'), 'copy change');
        return source;
    });
    expect(copied).toContain('value = 2');
    expect(await Bun.file(join(sandbox.path, 'packages/two/node_modules/owned/value.js')).text()).toContain(
        'value = 2',
    );
    await unlink(join(sandbox.path, 'node_modules/owned'));
    await symlink(sandbox.path, join(sandbox.path, 'node_modules/owned'), 'dir');
    expect(await captureRevisionFailure(sandbox.path)).toContain(
        `Installed dependency link ${join('node_modules', 'owned')} points to this repository or a parent folder.`,
    );
});

test('a workspace bin into untracked build output is left out of the copy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    const copied = await copyRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const bin = await lstat(join(copy, 'node_modules/.bin/cli')).catch((error: unknown) => error);
        return { package: await isOnDisk(join(copy, 'node_modules/cli/package.json')), bin };
    });
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
    const copied = await copyRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const location = join(copy, 'node_modules/external');
        const privateCopy = {
            location,
            path: await realpath(location),
            text: await readFile(join(location, 'private.txt'), 'utf8'),
        };
        await writeFile(join(location, 'private.txt'), 'private correction');
        return privateCopy;
    });
    expect(copied.path).toBe(copied.location);
    expect(copied.text).toBe('outside bytes');
    await unlink(join(sandbox.path, 'node_modules/external'));
    const source = await copyRevision(sandbox.path, { kind: 'index' }, (copy) =>
        Bun.file(join(copy, 'node_modules/example/index.js')).text(),
    );
    expect(source).toContain('value = 1');
    expect(await Bun.file(join(external.path, 'private.txt')).text()).toBe('outside bytes');
});

test('a nested revision copy links .gspot/node_modules instead of copying it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/.gspot/package.json': '{}',
        'project/.gspot/bun.lock': '{}',
        'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
        '.gitignore': 'node_modules/\n.gspot/state/\n',
    });
    stageRevision(sandbox.path);
    const project = join(sandbox.path, 'project');
    // The private tools run in place, so the copy links them instead of copying them.
    const copied = await copyRevision(project, { kind: 'index' }, async (copy) => {
        const tools = await lstat(join(copy, '.gspot/node_modules'));
        return {
            linked: tools.isSymbolicLink(),
            source: await Bun.file(join(copy, '.gspot/node_modules/example/index.js')).text(),
        };
    });
    expect(copied).toStrictEqual({ linked: true, source: 'export const value = 1;' });
});

test.each(['', 'nested/'])('revision copies reuse the installed Vale packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/config/vale.ini`;
    const packagePath = '.gspot/vale/Example/rule.yml';
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': '.gspot/vale/\n',
    });
    stageRevision(sandbox.path);
    const source = await copyRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const copied = join(copy, packagePath);
        const text = await Bun.file(copied).text();
        await Bun.write(copied, 'copy-only edit');
        return text;
    });
    expect(source).toBe('extends: existence\n');
    expect(await Bun.file(join(sandbox.path, packagePath)).text()).toBe('extends: existence\n');
    await Bun.write(join(sandbox.path, config), 'Packages = Different\n');
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
    const copied = await copyRevision(root, { kind: 'index' }, async (copy) => ({
        environment: await isOnDisk(join(copy, '.venv')),
        source: await readFile(join(copy, 'source.py'), 'utf8'),
    }));
    expect(copied).toStrictEqual({ environment: false, source: 'selected = True\n' });
    expect(await readFile(join(root, '.venv/bin/python'), 'utf8')).toBe('interpreter');
    await Bun.write(join(root, 'uv.lock'), 'version = 2\n');
    expect(await captureRevisionFailure(root)).toContain('do not match the revision manifests');
});

test('cancellation drains dependency copies before removing the copy and keeps installed files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    let entered = false;
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

    expect(
        await captureRejection(
            copyRevision(
                sandbox.path,
                { kind: 'index' },
                () => {
                    entered = true;
                    return Promise.resolve();
                },
                controller.signal,
            ),
        ),
    ).toContain('Canceled dependency copy');
    expect(pending).toBe(0);
    expect(entered).toBe(false);
    expect(destination).toBeDefined();
    expect(await isOnDisk(destination!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
        'export const value = 2;\n',
    );
});

test('a manifest checked out with CRLF matches its LF blob when Git converts line endings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{\n    "name": "crlf"\n}\n',
        'bun.lock': '{}\n',
        '.gitignore': 'node_modules/\n',
        'node_modules/example/index.js': 'export const value = 1;',
    });
    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['config', 'core.autocrlf', 'true']);
    readGitOutput(sandbox.path, ['add', '.']);
    await Bun.write(join(sandbox.path, 'package.json'), '{\r\n    "name": "crlf"\r\n}\r\n');
    const source = await copyRevision(sandbox.path, { kind: 'index' }, (copy) =>
        Bun.file(join(copy, 'node_modules/example/index.js')).text(),
    );
    expect(source).toContain('value = 1');
    await Bun.write(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    expect(await captureRevisionFailure(sandbox.path)).toContain('do not match the revision manifests');
});
