import { dirname, join } from 'node:path';
import * as promises from 'node:fs/promises';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { withRevisionSnapshot } from '#cli/repository/revisions/snapshot.ts';
import { rejection } from '#tests/support/rejection.ts';

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
    symlinkSync('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'));
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/owned/value.js')).text()).toContain('value = 2');
        await Bun.write(join(snapshot, 'node_modules/owned/value.js'), 'snapshot change');
    });
    expect(await Bun.file(join(sandbox.path, 'packages/two/node_modules/owned/value.js')).text()).toContain(
        'value = 2',
    );
    unlinkSync(join(sandbox.path, 'node_modules/owned'));
    symlinkSync(sandbox.path, join(sandbox.path, 'node_modules/owned'));
    expect(
        (await rejection(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined))).message,
    ).toContain('external link');
});

test('revision dependencies reject external manifest and installation links before copying', async () => {
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
        (await rejection(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined))).message,
    ).toContain('Source link leaves');
    unlinkSync(join(sandbox.path, 'package.json'));
    await Bun.write(join(sandbox.path, 'package.json'), '{}');
    symlinkSync(external.path, join(sandbox.path, 'node_modules/external'));
    expect(
        (await rejection(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined))).message,
    ).toContain('external link');
    unlinkSync(join(sandbox.path, 'node_modules/external'));
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
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
        '.gitignore': 'node_modules/\n.gspot/state/ownership.json\n.gspot/state/recovery/\n',
    });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, 'project');
    withLifecycleOwner(project, (owner) => {
        owner.beginInstallation('npm');
    });
    expect(
        (await rejection(withRevisionSnapshot(project, { kind: 'index' }, async () => undefined))).message,
    ).toContain('Tool installation is incomplete');
    withLifecycleOwner(project, (owner) => {
        owner.finishInstallation('npm');
    });
    await withRevisionSnapshot(project, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, '.gspot/node_modules/example/index.js')).text()).toContain('value = 1');
    });
});

test.each(['', 'nested/'])('revision prose checks reuse verified installed packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/config/vale.ini`;
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = vale/styles\nPackages = Example\n',
        '.gitignore': '.gspot/state/ownership.json\n.gspot/state/recovery/\n.gspot/config/vale/styles/Example/\n',
    });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, prefix);
    const packagePath = '.gspot/config/vale/styles/Example/rule.yml';
    withLifecycleOwner(project, (owner) => {
        owner.replace(packagePath, { bytes: Buffer.from('extends: existence\n'), mode: 0o644 }, 'config');
    });
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        const copied = join(snapshot, prefix, packagePath);
        expect(await Bun.file(copied).text()).toBe('extends: existence\n');
        await Bun.write(copied, 'snapshot-only edit');
    });
    expect(await Bun.file(join(project, packagePath)).text()).toBe('extends: existence\n');
    await Bun.write(join(sandbox.path, config), 'Packages = Different\n');
    expect(
        (await rejection(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined))).message,
    ).toContain('do not match the revision configuration');
    await Bun.write(join(sandbox.path, config), 'StylesPath = vale/styles\nPackages = Example\n');
    await Bun.write(join(project, packagePath), 'edited package');
    expect(
        (await rejection(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined))).message,
    ).toContain('missing or edited');
});

test.each([false, true])(
    'a Windows snapshot relocates a Distlib launcher with quoted path %s without changing its payload',
    async (quoted) => {
        await using repository = await testdir();
        const root = join(repository.path, "Windows author's project");
        const prefix = Buffer.from('MZ\u0000native executable bytes\u0000');
        const payload = Buffer.from('PK\u0003\u0004binary script payload\u0000ÿ', 'latin1');
        const interpreter = join(root, '.venv/Scripts/python.exe');
        const header = `#!${quoted ? `"${interpreter}"` : interpreter}\n`;
        const launcher = Buffer.concat([prefix, Buffer.from(header), payload]);
        await createFileTree(root, {
            '.gitignore': '.venv/\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            'source.py': 'selected = True\n',
            'uv.lock': 'version = 1\n',
            '.venv/pyvenv.cfg': `home = ${repository.path}\nversion_info = 3.12.2\ninclude-system-site-packages = false\n`,
            '.venv/Scripts/python.exe': 'MZinterpreter',
            '.venv/Scripts/check.exe': launcher,
            '.venv/Lib/site-packages/source.pth': `${root}\n`,
        });
        gitOutput(root, ['init', '-q']);
        gitOutput(root, ['add', '.']);
        await withRevisionSnapshot(root, { kind: 'index' }, async (snapshot) => {
            const relocated = readFileSync(join(snapshot, '.venv/Scripts/check.exe'));
            expect(relocated).toStrictEqual(
                Buffer.concat([prefix, Buffer.from(`#!"${join(snapshot, '.venv/Scripts/python.exe')}"\n`), payload]),
            );
            expect(readFileSync(join(snapshot, '.venv/Lib/site-packages/source.pth'), 'utf8')).toBe(`${snapshot}\n`);
            expect(readFileSync(join(snapshot, '.venv/Scripts/python.exe'), 'utf8')).toBe('MZinterpreter');
        });
        expect(readFileSync(join(root, '.venv/Scripts/check.exe'))).toStrictEqual(launcher);
        expect(readFileSync(join(root, '.venv/Lib/site-packages/source.pth'), 'utf8')).toBe(`${root}\n`);
    },
);

test('cancellation drains dependency copies before removing the snapshot and preserves installed files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"fixture","version":"1.0.0"}\n',
        'package-lock.json': '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
        'source.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            Array.from({ length: 24 }, (_, index) => [
                `node_modules/item-${index}/value.js`,
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
        if (typeof args[1] === 'string') destination = dirname(dirname(args[1]));
        try {
            await original(...args);
            controller.abort(new Error('Canceled dependency copy'));
        } finally {
            pending -= 1;
        }
    });
    try {
        expect(
            (
                await rejection(
                    withRevisionSnapshot(
                        sandbox.path,
                        { kind: 'index' },
                        async () => {
                            entered = true;
                        },
                        controller.signal,
                    ),
                )
            ).message,
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
