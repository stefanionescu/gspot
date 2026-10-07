import { join, dirname } from 'node:path';
import * as promises from 'node:fs/promises';
import { rejects } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { checkOutRevision } from '#cli/execution/copy/revision.ts';

import {
    lstatSync,
    mkdirSync,
    existsSync,
    unlinkSync,
    symlinkSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';

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
    symlinkSync('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'), 'dir');
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/owned/value.js')).text()).toContain('value = 2');
        await Bun.write(join(snapshot, 'node_modules/owned/value.js'), 'snapshot change');
    });
    expect(await Bun.file(join(sandbox.path, 'packages/two/node_modules/owned/value.js')).text()).toContain(
        'value = 2',
    );
    unlinkSync(join(sandbox.path, 'node_modules/owned'));
    symlinkSync(sandbox.path, join(sandbox.path, 'node_modules/owned'), 'dir');
    expect(
        await rejection(checkOutRevision(sandbox.path, { kind: 'index' }, () => Promise.resolve(undefined))),
    ).toContain('Installed dependency link node_modules/owned leaves the repository.');
});

test('a workspace bin into untracked build output leaves the snapshot, and a broken link stops it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        'bun.lock': '{}',
        'packages/cli/package.json': '{"name":"cli","bin":{"cli":"dist/cli.js"}}',
        'packages/cli/dist/cli.js': 'console.log(1);',
        '.gitignore': 'node_modules/\ndist/\n',
    });
    mkdirSync(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    symlinkSync('../packages/cli', join(sandbox.path, 'node_modules/cli'), 'dir');
    symlinkSync('../cli/dist/cli.js', join(sandbox.path, 'node_modules/.bin/cli'));
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    await checkOutRevision(sandbox.path, { kind: 'index' }, (snapshot) => {
        expect(existsSync(join(snapshot, 'node_modules/cli/package.json'))).toBe(true);
        expect(lstatSync(join(snapshot, 'node_modules/.bin/cli'), { throwIfNoEntry: false })).toBeUndefined();
        return Promise.resolve(undefined);
    });
    symlinkSync('../missing/tool.js', join(sandbox.path, 'node_modules/.bin/broken'));
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
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    unlinkSync(join(sandbox.path, 'package.json'));
    symlinkSync(join(external.path, 'package.json'), join(sandbox.path, 'package.json'));
    expect(
        await rejection(checkOutRevision(sandbox.path, { kind: 'index' }, () => Promise.resolve(undefined))),
    ).toContain('Source link leaves');
    unlinkSync(join(sandbox.path, 'package.json'));
    await Bun.write(join(sandbox.path, 'package.json'), '{}');
    symlinkSync(external.path, join(sandbox.path, 'node_modules/external'));
    await checkOutRevision(sandbox.path, { kind: 'index' }, (snapshot) => {
        expect(realpathSync(join(snapshot, 'node_modules/external'))).toBe(join(snapshot, 'node_modules/external'));
        expect(readFileSync(join(snapshot, 'node_modules/external/private.txt'), 'utf8')).toBe('outside bytes');
        writeFileSync(join(snapshot, 'node_modules/external/private.txt'), 'private correction');
        return Promise.resolve(undefined);
    });
    unlinkSync(join(sandbox.path, 'node_modules/external'));
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/example/index.js')).text()).toContain('value = 1');
    });
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
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, 'project');
    {
        using log = openOwnership(project);
        log.state.installing = ['npm'];
        log.save();
    }
    expect(await rejection(checkOutRevision(project, { kind: 'index' }, () => Promise.resolve(undefined)))).toContain(
        'Tool installation is incomplete',
    );
    {
        using log = openOwnership(project);
        delete log.state.installing;
        log.save();
    }
    await checkOutRevision(project, { kind: 'index' }, async (snapshot) => {
        // The private tools run in place, so the snapshot links them instead of copying them.
        expect(lstatSync(join(snapshot, '.gspot/node_modules')).isSymbolicLink()).toBe(true);
        expect(await Bun.file(join(snapshot, '.gspot/node_modules/example/index.js')).text()).toContain('value = 1');
    });
});

test.each(['', 'nested/'])('revision prose checks reuse the installed packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/config/vale.ini`;
    const packagePath = '.gspot/config/vale/styles/Example/rule.yml';
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = vale/styles\nPackages = Example\n',
        [`${prefix}${packagePath}`]: 'extends: existence\n',
        '.gitignore': '.gspot/config/vale/styles/Example/\n',
    });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, prefix);
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (snapshot) => {
        const copied = join(snapshot, prefix, packagePath);
        expect(await Bun.file(copied).text()).toBe('extends: existence\n');
        await Bun.write(copied, 'snapshot-only edit');
    });
    expect(await Bun.file(join(project, packagePath)).text()).toBe('extends: existence\n');
    await Bun.write(join(sandbox.path, config), 'Packages = Different\n');
    expect(
        await rejection(checkOutRevision(sandbox.path, { kind: 'index' }, () => Promise.resolve(undefined))),
    ).toContain('do not match the revision configuration');
});

test('a snapshot leaves the virtual environment in the working tree and still checks its lockfile', async () => {
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
    gitOutput(root, ['init', '-q']);
    gitOutput(root, ['add', '.']);
    await checkOutRevision(root, { kind: 'index' }, (snapshot) => {
        expect(existsSync(join(snapshot, '.venv'))).toBe(false);
        expect(readFileSync(join(snapshot, 'source.py'), 'utf8')).toBe('selected = True\n');
        return Promise.resolve();
    });
    expect(readFileSync(join(root, '.venv/bin/python'), 'utf8')).toBe('interpreter');
    await Bun.write(join(root, 'uv.lock'), 'version = 2\n');
    expect(await rejection(checkOutRevision(root, { kind: 'index' }, () => Promise.resolve(undefined)))).toContain(
        'do not match the revision manifests',
    );
});

test('cancellation drains dependency copies before removing the snapshot and preserves installed files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"fixture","version":"1.0.0"}\n',
        'package-lock.json': '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
        'source.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            Array.from({ length: 24 }, (_, index) => [
                `node_modules/item-${String(index)}/value.js`,
                'export const value = 2;\n',
            ]),
        ),
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '-A']);
    const controller = new AbortController();
    const original = promises.cp;
    let pending = 0;
    let destination: string | undefined;
    let entered = false;
    const copy = spyOn(promises, 'cp').mockImplementation(async (...args) => {
        pending += 1;
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
        expect(existsSync(destination!)).toBe(false);
        expect(readFileSync(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
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
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/example/index.js')).text()).toContain('value = 1');
    });
    await Bun.write(join(sandbox.path, 'package.json'), '{\r\n    "name": "changed"\r\n}\r\n');
    expect(
        await rejection(checkOutRevision(sandbox.path, { kind: 'index' }, () => Promise.resolve(undefined))),
    ).toContain('do not match the revision manifests');
});
