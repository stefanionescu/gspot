// The ownership state stays bounded: installations are recorded whole, and no copy of a replaced file is kept.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readdir, readFile } from 'node:fs/promises';
import { pathExists } from '#tests/harness/preservation.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { proposeBlock, proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { installTree, readInstalledTree, deleteInstallation } from '#cli/lifecycle/ownership/installations.ts';
import { SWAP_CASES, BLOCK_CASES, ADOPTED_FILE_CASES } from '#tests/config/cli/lifecycle/ownership/bounded-state.ts';

test('an installation is one record, and removing it deletes the folder', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
        expect(getOwnership(directory.path)).toMatchObject({ files: [], installed: ['npm'] });
        deleteInstallation(log, 'npm');
        expect(await pathExists(join(directory.path, '.gspot/node_modules'))).toBe(false);
        expect(getOwnership(directory.path).installed).toBeUndefined();
    }
});

test('an installation refuses a folder gspot did not install and leaves it as it was', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(directory.path, { '.gspot/node_modules/authored/index.js': 'authored\n' });
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    {
        using log = openOwnership(directory.path);

        expect(() => {
            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
        }).toThrow('.gspot/node_modules exists and gspot did not create it. Move it aside, then run gspot install.');
        expect(await pathExists(join(directory.path, '.gspot/node_modules/authored/index.js'))).toBe(true);
        expect(getOwnership(directory.path).installing).toBeUndefined();
    }
});

test.each(SWAP_CASES)('an interrupted swap retains the correct folder when $name', async ({ files, kept }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.gspot/state/ownership.json': `${JSON.stringify({ version: 1, files: [], installing: ['npm'] })}\n`,
        '.gspot/node_modules.previous/tool/index.js': 'previous\n',
        '.gspot/node_modules.next/tool/index.js': 'partial\n',
        ...files,
    });
    openOwnership(directory.path)[Symbol.dispose]();
    expect(await readFile(join(directory.path, '.gspot/node_modules/tool/index.js'), 'utf8')).toBe(kept);
    expect(await pathExists(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
    expect(await pathExists(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
    expect(getOwnership(directory.path).installing).toStrictEqual(['npm']);
});

test('an install killed after its swap and before its record is replaced by the next install', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(directory.path, {
        '.gspot/state/ownership.json': `${JSON.stringify({ version: 1, files: [], installing: ['npm'] })}\n`,
        '.gspot/node_modules/tool/index.js': 'swapped\n',
    });
    await createFileTree(staged.path, { 'tool/index.js': 'reinstalled\n' });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
    }
    expect(await readFile(join(directory.path, '.gspot/node_modules/tool/index.js'), 'utf8')).toBe('reinstalled\n');
    expect(getOwnership(directory.path)).toMatchObject({ installed: ['npm'] });
    expect(getOwnership(directory.path).installing).toBeUndefined();
});

test.each(BLOCK_CASES)(
    'removing a managed block restores the original state when $name',
    async ({ files, isCreated, kept }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, files);
        {
            using log = openOwnership(directory.path);

            applyPlan(log, proposeBlock(log, 'NOTES.md', 'managed text', 'markdown'));
            expect(getOwnership(directory.path).files[0]).toMatchObject({ block: { created: isCreated } });
            expect(applyPlan(log, proposeRestoration(log, 'NOTES.md'))).toBe('changed');
        }
        const path = join(directory.path, 'NOTES.md');
        expect((await pathExists(path)) ? await readFile(path, 'utf8') : undefined).toBe(kept);
    },
);

test('a replaced file keeps no copy, and giving it back deletes it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            proposeReplacement(log, {
                path: 'config.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'config',
                canReplace: true,
            }),
        );
        expect(await readdir(join(directory.path, '.gspot/state'))).toContain('ownership.json');
        expect(await readdir(join(directory.path, '.gspot/state'))).not.toContain('recovery');
        expect(applyPlan(log, proposeRestoration(log, 'config.txt'))).toBe('changed');
    }
    expect(await pathExists(join(directory.path, 'config.txt'))).toBe(false);
});

test('giving back the last file of a folder removes the folders it leaves empty', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'guides/kept.md': 'authored\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            proposeReplacement(log, {
                path: 'guides/agent/rules/WORKING.md',
                next: { bytes: Buffer.from('guide\n'), mode: 0o644 },
                kind: 'config',
                canReplace: true,
            }),
        );
        expect(applyPlan(log, proposeRestoration(log, 'guides/agent/rules/WORKING.md'))).toBe('changed');
    }
    expect(await pathExists(join(directory.path, 'guides/agent'))).toBe(false);
    expect(await readdir(join(directory.path, 'guides'))).toStrictEqual(['kept.md']);
});

test.each(ADOPTED_FILE_CASES)(
    'restoring an adopted file retains only authored bytes: $name',
    async ({ path, isChanged, isKept }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { [path]: '{"v":1}\n' });
        {
            using log = openOwnership(directory.path);

            const mode = log.files.read(path)!.mode;
            expect(
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: path,
                        next: { bytes: Buffer.from('{"v":1}\n'), mode },
                        kind: 'config',
                    }),
                ),
            ).toBe('unchanged');
            expect(getOwnership(directory.path).files[0]?.adopted).toBe(true);
            if (isChanged)
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: path,
                        next: { bytes: Buffer.from('{"v":2}\n'), mode },
                        kind: 'config',
                    }),
                );
            expect(applyPlan(log, proposeRestoration(log, path))).toBe('changed');
        }
        expect(await pathExists(join(directory.path, path))).toBe(isKept);
        expect(getOwnership(directory.path).files).toStrictEqual([]);
    },
);
