// The ownership state stays bounded: installations are recorded whole, and no copy of a replaced file is kept.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { openOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';

test('an installation is one record, and removing it deletes the folder', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    const owner = openOwner(directory.path);
    try {
        owner.installTree('npm', installedOutputs(staged.path, 'npm'));
        expect(readOwnership(directory.path)).toMatchObject({ files: [], installs: ['npm'] });
        owner.removeInstallation('npm');
        expect(existsSync(join(directory.path, '.gspot/node_modules'))).toBe(false);
        expect(readOwnership(directory.path).installs).toBeUndefined();
    } finally {
        owner.close();
    }
});

test('an installation refuses a folder gspot did not install and leaves it as it was', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(directory.path, { '.gspot/node_modules/authored/index.js': 'authored\n' });
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    const owner = openOwner(directory.path);
    try {
        expect(() => {
            owner.installTree('npm', installedOutputs(staged.path, 'npm'));
        }).toThrow('Preserved unowned .gspot/node_modules');
        expect(existsSync(join(directory.path, '.gspot/node_modules/authored/index.js'))).toBe(true);
        expect(readOwnership(directory.path).installations).toBeUndefined();
    } finally {
        owner.close();
    }
});

test.each([true, false])(
    'an interrupted swap recovers the previous folder when the new one is missing (%s)',
    async (isMissing) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            '.gspot/state/ownership.json': `${JSON.stringify({ version: 1, files: [], installations: ['npm'] })}\n`,
            '.gspot/node_modules.previous/tool/index.js': 'previous\n',
            '.gspot/node_modules.next/tool/index.js': 'partial\n',
            ...(isMissing ? {} : { '.gspot/node_modules/tool/index.js': 'swapped\n' }),
        });
        openOwner(directory.path).close();
        const kept = isMissing ? 'previous\n' : 'swapped\n';
        expect(readFileSync(join(directory.path, '.gspot/node_modules/tool/index.js'), 'utf8')).toBe(kept);
        expect(existsSync(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
        expect(existsSync(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
        expect(readOwnership(directory.path).installations).toStrictEqual(['npm']);
    },
);

test.each([true, false])(
    'removing a managed block deletes the file only when the block created it (%s)',
    async (isCreated) => {
        await using directory = await testdir();
        if (!isCreated) await createFileTree(directory.path, { 'NOTES.md': 'Authored.\n' });
        const owner = openOwner(directory.path);
        try {
            owner.applyPlan(owner.proposeBlock('NOTES.md', 'managed text', 'markdown'));
            expect(readOwnership(directory.path).files[0]).toMatchObject({ block: { created: isCreated } });
            expect(owner.applyPlan(owner.proposeRestoration('NOTES.md'))).toBe('changed');
        } finally {
            owner.close();
        }
        const path = join(directory.path, 'NOTES.md');
        expect(existsSync(path) ? readFileSync(path, 'utf8') : undefined).toBe(isCreated ? undefined : 'Authored.\n');
    },
);

test('a replaced file keeps no copy, and giving it back deletes it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true);
        expect(readdirSync(join(directory.path, '.gspot/state'))).toContain('ownership.json');
        expect(readdirSync(join(directory.path, '.gspot/state'))).not.toContain('recovery');
        expect(owner.applyPlan(owner.proposeRestoration('config.txt'))).toBe('changed');
    } finally {
        owner.close();
    }
    expect(existsSync(join(directory.path, 'config.txt'))).toBe(false);
});

test('giving back the last file of a folder removes the folders it leaves empty', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'guides/kept.md': 'authored\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('guides/agent/rules/WORKING.md', { bytes: Buffer.from('guide\n'), mode: 0o644 }, 'config', true);
        expect(owner.applyPlan(owner.proposeRestoration('guides/agent/rules/WORKING.md'))).toBe('changed');
    } finally {
        owner.close();
    }
    expect(existsSync(join(directory.path, 'guides/agent'))).toBe(false);
    expect(readdirSync(join(directory.path, 'guides'))).toStrictEqual(['kept.md']);
});

test.each([true, false])(
    'an adopted file stays when given back, until gspot writes other bytes into it (%s)',
    async (isChanged) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/config/tool.json': '{"v":1}\n' });
        const path = '.gspot/config/tool.json';
        const owner = openOwner(directory.path);
        try {
            const mode = owner.read(path)!.mode;
            expect(owner.replace(path, { bytes: Buffer.from('{"v":1}\n'), mode }, 'config')).toBe('unchanged');
            expect(readOwnership(directory.path).files[0]?.adopted).toBe(true);
            if (isChanged) owner.replace(path, { bytes: Buffer.from('{"v":2}\n'), mode }, 'config');
            expect(owner.applyPlan(owner.proposeRestoration(path))).toBe('changed');
        } finally {
            owner.close();
        }
        expect(existsSync(join(directory.path, path))).toBe(!isChanged);
        expect(readOwnership(directory.path).files).toStrictEqual([]);
    },
);
