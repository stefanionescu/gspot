// The ownership state stays bounded: installations are recorded whole, finished backups go, and a retired file of
// the .gspot folder is forgotten.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { planUninstall, applyUninstall } from '#cli/commands/uninstall.ts';
import { openOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const RECOVERY = '.gspot/state/recovery';

// Every file left under the recovery folder, by its name.
function recoveryFiles(root: string): string[] {
    const folder = join(root, RECOVERY);
    if (!existsSync(folder)) return [];
    return readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
}

test('an installation is one record, uninstall plans it, and removing it deletes the folder', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    const owner = openOwner(directory.path);
    try {
        owner.installTree('npm', installedOutputs(staged.path, 'npm'));
        expect(readOwnership(directory.path)).toMatchObject({ files: [], installs: ['npm'] });
        expect(planUninstall(directory.path).installs).toStrictEqual(['npm']);
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

test('a finished operation keeps only the original of an authored file, and a stale recovery folder is pruned', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'config.txt': 'authored\n',
        [`${RECOVERY}/00000000-0000-4000-8000-000000000000/11111111-1111-4111-8111-111111111111.original`]: 'stale\n',
    });
    const owner = openOwner(directory.path);
    try {
        expect(recoveryFiles(directory.path)).toStrictEqual([]);
        owner.replace('config.txt', { bytes: Buffer.from('first\n'), mode: 0o644 }, 'config', true);
        owner.replace('config.txt', { bytes: Buffer.from('second\n'), mode: 0o644 }, 'config');
        const original = readOwnership(directory.path).files[0]?.original?.backup;
        expect(original).toBeDefined();
        const name = original!.slice(original!.lastIndexOf('/') + 1);
        expect(recoveryFiles(directory.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            name,
            `${name}.json`,
        ]);
        expect(owner.restore('config.txt')).toBe('changed');
        expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('authored\n');
    } finally {
        owner.close();
    }
});

test('a retired file of the gspot folder is forgotten with its original, and uninstall does not bring it back', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/old/output.json': '{}\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('.gspot/old/output.json', { bytes: Buffer.from('{"a":1}\n'), mode: 0o644 }, 'config', true);
        owner.applyPlan(owner.proposeRetirement('.gspot/old/output.json', owner.read('.gspot/old/output.json')!));
    } finally {
        owner.close();
    }
    writeFileSync(join(directory.path, 'unrelated.txt'), 'kept\n');
    openOwner(directory.path).close();
    expect(readOwnership(directory.path).files).toStrictEqual([]);
    expect(recoveryFiles(directory.path)).toStrictEqual([]);
    expect(planUninstall(directory.path).remove).toStrictEqual([]);
});

test.each([true, false])(
    'a managed block keeps no backup and removing it deletes the file only when the block created it (%s)',
    async (isCreated) => {
        await using directory = await testdir();
        if (!isCreated) await createFileTree(directory.path, { 'NOTES.md': 'Authored.\n' });
        const owner = openOwner(directory.path);
        try {
            owner.applyPlan(owner.proposeBlock('NOTES.md', 'managed text', 'markdown'));
            expect(readOwnership(directory.path).files[0]).toMatchObject({ block: { created: isCreated } });
            expect(readOwnership(directory.path).files[0]?.original).toBeUndefined();
            expect(recoveryFiles(directory.path)).toStrictEqual([]);
            expect(owner.restore('NOTES.md')).toBe('changed');
        } finally {
            owner.close();
        }
        const path = join(directory.path, 'NOTES.md');
        expect(existsSync(path) ? readFileSync(path, 'utf8') : undefined).toBe(isCreated ? undefined : 'Authored.\n');
    },
);

test('uninstall deletes the folders gspot keeps for itself and the .gspot folder with them', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.gspot/cache/result.json': '{}\n',
        '.gspot/reports/report.json': '{}\n',
        '.gspot/config/vale.ini': 'Packages = Google\n',
        '.gspot/config/vale/styles/Google/terms.yml': 'extends: existence\n',
    });
    const owner = openOwner(directory.path);
    try {
        owner.replace('.gspot/config/generated.json', { bytes: Buffer.from('{}\n'), mode: 0o644 }, 'config');
    } finally {
        owner.close();
    }
    const plan = planUninstall(directory.path);
    expect(plan.folders.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/cache',
        '.gspot/config/vale/styles/Google',
        '.gspot/reports',
    ]);
    expect(applyUninstall(directory.path, plan)).toStrictEqual([]);
    expect(readdirSync(join(directory.path, '.gspot'), { recursive: true })).toStrictEqual([
        'config',
        join('config', 'vale.ini'),
    ]);
});

test('uninstall keeps the recovery data while an edited file still has its original there', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true);
    } finally {
        owner.close();
    }
    writeFileSync(join(directory.path, 'config.txt'), 'edited later\n');
    expect(applyUninstall(directory.path, planUninstall(directory.path))).toStrictEqual(['config.txt']);
    const original = readOwnership(directory.path).files[0]?.original?.backup;
    expect(readFileSync(join(directory.path, original!), 'utf8')).toBe('authored\n');
});

test('an adopted file keeps no copy until gspot first changes it, and that change saves the original', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/config/tool.json': '{"v":1}\n' });
    const path = '.gspot/config/tool.json';
    const owner = openOwner(directory.path);
    try {
        const mode = owner.read(path)!.mode;
        expect(owner.replace(path, { bytes: Buffer.from('{"v":1}\n'), mode }, 'config')).toBe('unchanged');
        expect(readOwnership(directory.path).files[0]?.original?.backup).toBeUndefined();
        expect(recoveryFiles(directory.path)).toStrictEqual([]);
        expect(owner.replace(path, { bytes: Buffer.from('{"v":2}\n'), mode }, 'config')).toBe('changed');
        const backup = readOwnership(directory.path).files[0]?.original?.backup;
        expect(readFileSync(join(directory.path, backup!), 'utf8')).toBe('{"v":1}\n');
        expect(owner.restore(path)).toBe('changed');
    } finally {
        owner.close();
    }
    expect(readFileSync(join(directory.path, path), 'utf8')).toBe('{"v":1}\n');
});

test('a finished operation that keeps no original leaves no recovery folder', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored\n' });
    const owner = openOwner(directory.path);
    try {
        owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true);
        expect(owner.restore('config.txt')).toBe('changed');
    } finally {
        owner.close();
    }
    expect(readdirSync(join(directory.path, '.gspot/state'))).toStrictEqual(['ownership.json']);
});
