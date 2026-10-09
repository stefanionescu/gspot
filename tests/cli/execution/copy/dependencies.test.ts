import { join, dirname } from 'node:path';
import { rejects } from 'node:assert/strict';
import * as promises from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { checkOutRevision } from '#cli/execution/copy/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { lstat, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

/** Stages dependency declarations and authored files for a revision copy. */
function stageRevision(root: string): void {
    gitOutput(root, ['init']);
    gitOutput(root, ['add', '.']);
}

/** Reads the error from a revision that must refuse its dependency state. */
async function revisionFailure(root: string): Promise<string> {
    return await rejection(checkOutRevision(root, { kind: 'index' }, () => Promise.resolve(undefined)));
}

test('staged snapshots copy all workspace dependency trees before validating cross-tree links', async () => {
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
    const copied = await checkOutRevision(sandbox.path, { kind: 'index' }, async (copy) => {
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
    expect(await revisionFailure(sandbox.path)).toContain(
        `Installed dependency link ${join('node_modules', 'owned')} leaves the repository.`,
    );
});

test('a workspace bin into untracked build output leaves the copy, and a broken link stops it', async () => {
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
    const copied = await checkOutRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const bin = await lstat(join(copy, 'node_modules/.bin/cli')).catch((error: unknown) => error);
        return { package: await pathExists(join(copy, 'node_modules/cli/package.json')), bin };
    });
    expect(copied).toMatchObject({ package: true, bin: { code: 'ENOENT' } });
    await symlink('../missing/tool.js', join(sandbox.path, 'node_modules/.bin/broken'));
    await rejects(
        checkOutRevision(sandbox.path, { kind: 'index' }, () => Promise.resolve(undefined)),
        { code: 'ENOENT' },
    );
});

test('revision manifests refuse external links while external dependencies are privately cloned', async () => {
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
    await unlink(join(sandbox.path, 'package.json'));
    await symlink(join(external.path, 'package.json'), join(sandbox.path, 'package.json'));
    expect(await revisionFailure(sandbox.path)).toContain('Source link leaves');
    await unlink(join(sandbox.path, 'package.json'));
    await Bun.write(join(sandbox.path, 'package.json'), '{}');
    await symlink(external.path, join(sandbox.path, 'node_modules/external'));
    const copied = await checkOutRevision(sandbox.path, { kind: 'index' }, async (copy) => {
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
    const source = await checkOutRevision(sandbox.path, { kind: 'index' }, (copy) =>
        Bun.file(join(copy, 'node_modules/example/index.js')).text(),
    );
    expect(source).toContain('value = 1');
    expect(await Bun.file(join(external.path, 'private.txt')).text()).toBe('outside bytes');
});

test('a nested revision refuses its incomplete managed dependency installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/.gspot/package.json': '{}',
        'project/.gspot/bun.lock': '{}',
        'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
        '.gitignore': 'node_modules/\n.gspot/state/\n',
    });
    stageRevision(sandbox.path);
    const project = join(sandbox.path, 'project');
    {
        using log = openOwnership(project);
        log.state.installing = ['npm'];
        log.save();
    }
    expect(await revisionFailure(project)).toContain('Tool installation is incomplete');
    {
        using log = openOwnership(project);
        delete log.state.installing;
        log.save();
    }
    // The private tools run in place, so the copy links them instead of copying them.
    const copied = await checkOutRevision(project, { kind: 'index' }, async (copy) => {
        const tools = await lstat(join(copy, '.gspot/node_modules'));
        return {
            linked: tools.isSymbolicLink(),
            source: await Bun.file(join(copy, '.gspot/node_modules/example/index.js')).text(),
        };
    });
    expect(copied).toStrictEqual({ linked: true, source: 'export const value = 1;' });
});

test.each(['', 'nested/'])('revision prose checks reuse the installed packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/config/vale.ini`;
    const packagePath = '.gspot/vale/Example/rule.yml';
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = ../vale\nPackages = Example\n',
        [packagePath]: 'extends: existence\n',
        '.gitignore': '.gspot/vale/\n',
    });
    stageRevision(sandbox.path);
    const source = await checkOutRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        const copied = join(copy, packagePath);
        const text = await Bun.file(copied).text();
        await Bun.write(copied, 'copy-only edit');
        return text;
    });
    expect(source).toBe('extends: existence\n');
    expect(await Bun.file(join(sandbox.path, packagePath)).text()).toBe('extends: existence\n');
    await Bun.write(join(sandbox.path, config), 'Packages = Different\n');
    expect(await revisionFailure(sandbox.path)).toContain('do not match the revision configuration');
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
    const copied = await checkOutRevision(root, { kind: 'index' }, async (copy) => ({
        environment: await pathExists(join(copy, '.venv')),
        source: await readFile(join(copy, 'source.py'), 'utf8'),
    }));
    expect(copied).toStrictEqual({ environment: false, source: 'selected = True\n' });
    expect(await readFile(join(root, '.venv/bin/python'), 'utf8')).toBe('interpreter');
    await Bun.write(join(root, 'uv.lock'), 'version = 2\n');
    expect(await revisionFailure(root)).toContain('do not match the revision manifests');
});

test('cancellation drains dependency copies before removing the copy and preserves installed files', async () => {
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
    const copy = spyOn(promises, 'cp').mockImplementation(async (...args) => {
        pending += 1;
        // The copied node_modules folder sits one level below the scratch root.
        if (typeof args[1] === 'string') destination = dirname(args[1]);
        try {
            await original(...args);
            controller.abort(new Error('Canceled dependency copy'));
        } finally {
            pending -= 1;
        }
    });
    try {
        expect(
            await rejection(
                checkOutRevision(
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
        expect(await pathExists(destination!)).toBe(false);
        expect(await readFile(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
            'export const value = 2;\n',
        );
    } finally {
        copy.mockRestore();
    }
});

test('a manifest checked out with CRLF matches its LF blob when Git converts line endings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{\n    "name": "crlf"\n}\n',
        'bun.lock': '{}\n',
        '.gitignore': 'node_modules/\n',
        'node_modules/example/index.js': 'export const value = 1;',
    });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['config', 'core.autocrlf', 'true']);
    gitOutput(sandbox.path, ['add', '.']);
    await Bun.write(join(sandbox.path, 'package.json'), '{\r\n    "name": "crlf"\r\n}\r\n');
    const source = await checkOutRevision(sandbox.path, { kind: 'index' }, (copy) =>
        Bun.file(join(copy, 'node_modules/example/index.js')).text(),
    );
    expect(source).toContain('value = 1');
    await Bun.write(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    expect(await revisionFailure(sandbox.path)).toContain('do not match the revision manifests');
});
