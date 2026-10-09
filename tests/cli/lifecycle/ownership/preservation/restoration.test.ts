import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { getCliSourcePath } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { OWNERSHIP_BYTES, OWNERSHIP_REFUSAL } from '#tests/config/samples/ownership.ts';
import { applyPlans, getOwnership, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { planBlock, planReplacement, planRestoration } from '#cli/lifecycle/ownership/contracts.ts';
import { stat, chmod, lstat, unlink, readdir, symlink, readFile, readlink, writeFile } from 'node:fs/promises';
import { BLOCK_CASES, ADOPTED_FILE_CASES } from '#tests/config/cli/lifecycle/ownership/preservation/restoration.ts';

const replacedFiles = async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
    const original = Buffer.from(OWNERSHIP_BYTES.restoration);
    await writeFile(join(directory.path, 'config.txt'), original, { mode: 0o640 });
    let log = openOwnership(directory.path);
    try {
        expect(
            applyPlans(log, [
                planReplacement(log, {
                    path: 'config.txt',
                    next: { bytes: Buffer.from('first'), mode: 0o444 },
                    kind: 'tool_file',
                    canReplace: true,
                }),
            ])[0],
        ).toBe('changed');
        expect(
            applyPlans(log, [
                planReplacement(log, {
                    path: 'config.txt',
                    next: { bytes: Buffer.from('second'), mode: 0o444 },
                    kind: 'tool_file',
                }),
            ])[0],
        ).toBe('changed');
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlans(log, [planRestoration(log, 'config.txt')])[0]).toBe('changed');
        expect(log.files.read('config.txt')).toBeUndefined();
        expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        const ownershipMetadata = await stat(join(directory.path, '.gspot/state/ownership.json'));
        expect(ownershipMetadata.mode & 0o777).toBe(getKeptMode(0o600));
    } finally {
        log[Symbol.dispose]();
    }
};

const installedLinks = async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'vendor/tools/tool/bin.sh': '#!/bin/sh\nprintf installed',
        'vendor/tools/tool/original.sh': '#!/bin/sh\nprintf original',
        'vendor/tools/.bin/.keep': '',
    });
    const path = 'vendor/tools/.bin/tool';
    const absolute = join(directory.path, path);
    await chmod(join(directory.path, 'vendor/tools/tool/bin.sh'), 0o755);
    await chmod(join(directory.path, 'vendor/tools/tool/original.sh'), 0o755);
    await symlink('../tool/original.sh', absolute);
    const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
    let log = openOwnership(directory.path);
    try {
        expect(() => applyPlans(log, [planReplacement(log, { path: path, next: next, kind: 'tool_file' })])).toThrow(
            `The file ${path} ${OWNERSHIP_REFUSAL}`,
        );
        expect(
            applyPlans(log, [planReplacement(log, { path: path, next: next, kind: 'tool_file', canReplace: true })])[0],
        ).toBe('changed');
        expect(applyPlans(log, [planReplacement(log, { path: path, next: next, kind: 'tool_file' })])[0]).toBe(
            'unchanged',
        );
        const executed = runTestCommandBlocking([absolute], { cwd: directory.path });
        expect(executed.code, executed.stderr).toBe(0);
        expect(executed.stdout).toBe('installed');
        // A lifecycle file read refuses an installed link instead of reading its target.
        expect(() => log.files.read(path)).toThrow(`Lifecycle destination is not a private regular file: ${path}`);
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlans(log, [planRestoration(log, path)])[0]).toBe('changed');
        expect(await lstat(absolute).catch((error: unknown) => error)).toMatchObject({ code: 'ENOENT' });
        const originalMetadata = await stat(join(directory.path, 'vendor/tools/tool/original.sh'));
        expect(originalMetadata.mode & 0o777).toBe(getKeptMode(0o755));
        expect(
            applyPlans(log, [planReplacement(log, { path: path, next: next, kind: 'tool_file', canReplace: true })])[0],
        ).toBe('changed');
        // Later user edits remain intact across replacement and giving the file back.
        await unlink(absolute);
        await symlink('../tool/original.sh', absolute);
        expect(() => applyPlans(log, [planReplacement(log, { path: path, next: next, kind: 'tool_file' })])).toThrow(
            `The file ${path} ${OWNERSHIP_REFUSAL}`,
        );
        expect(() => applyPlans(log, [planRestoration(log, path)])).toThrow(`The file ${path} ${OWNERSHIP_REFUSAL}`);
        expect(await readlink(absolute)).toBe('../tool/original.sh');
    } finally {
        log[Symbol.dispose]();
    }
};

const regularReplacement = async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { target: 'authored target' });
    const log = openOwnership(directory.path);
    const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
    try {
        expect(applyPlans(log, [planReplacement(log, { path: 'tool', next: next, kind: 'tool_file' })])[0]).toBe(
            'changed',
        );
        await unlink(join(directory.path, 'tool'));
        await writeFile(join(directory.path, 'tool'), 'target', { mode: 0o777 });
        expect(() => applyPlans(log, [planReplacement(log, { path: 'tool', next: next, kind: 'tool_file' })])).toThrow(
            `The file tool ${OWNERSHIP_REFUSAL}`,
        );
        expect(() => applyPlans(log, [planRestoration(log, 'tool')])).toThrow(`The file tool ${OWNERSHIP_REFUSAL}`);
        const restoredMetadata = await lstat(join(directory.path, 'tool'));
        expect(restoredMetadata.isFile()).toBe(true);
        expect(await readFile(join(directory.path, 'target'), 'utf8')).toBe('authored target');
    } finally {
        log[Symbol.dispose]();
    }
};

describe('lifecycle ownership', () => {
    test.skipIf(!isPosix)(
        'giving back a twice replaced file deletes it, keeps unowned files, and keeps the log private',
        replacedFiles,
    );

    test.skipIf(!isPosix)(
        'installed executable links run, giving them back deletes them, and later edits stay',
        installedLinks,
    );

    test.skipIf(!isPosix)(
        'a regular file containing a link target is preserved after replacing an installed link',
        regularReplacement,
    );
});

test.each(BLOCK_CASES)(
    'removing a managed block restores the original state when $name',
    async ({ files, isCreated, kept }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, files);
        {
            using log = openOwnership(directory.path);

            applyPlans(log, [planBlock(log, 'NOTES.md', 'managed text', 'markdown')]);
            expect(getOwnership(directory.path).files[0]).toMatchObject({ block: { created: isCreated } });
            expect(applyPlans(log, [planRestoration(log, 'NOTES.md')])[0]).toBe('changed');
        }
        const path = join(directory.path, 'NOTES.md');
        expect((await pathExists(path)) ? await readFile(path, 'utf8') : undefined).toBe(kept);
    },
);

test('giving back the last file of a folder removes the folders it leaves empty', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'guides/kept.md': 'authored\n' });
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            planReplacement(log, {
                path: 'guides/agent/rules/WORKING.md',
                next: { bytes: Buffer.from('guide\n'), mode: 0o644 },
                kind: 'tool_file',
                canReplace: true,
            }),
        ]);
        expect(applyPlans(log, [planRestoration(log, 'guides/agent/rules/WORKING.md')])[0]).toBe('changed');
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
                applyPlans(log, [
                    planReplacement(log, {
                        path: path,
                        next: { bytes: Buffer.from('{"v":1}\n'), mode },
                        kind: 'tool_file',
                    }),
                ])[0],
            ).toBe('unchanged');
            expect(getOwnership(directory.path).files[0]?.adopted).toBe(true);
            if (isChanged)
                applyPlans(log, [
                    planReplacement(log, {
                        path: path,
                        next: { bytes: Buffer.from('{"v":2}\n'), mode },
                        kind: 'tool_file',
                    }),
                ]);
            expect(applyPlans(log, [planRestoration(log, path)])[0]).toBe('changed');
        }
        expect(await pathExists(join(directory.path, path))).toBe(isKept);
        expect(getOwnership(directory.path).files).toStrictEqual([]);
    },
);

test('Windows permission projection supports repeated log writes, idempotent replacement, and removal', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored bytes' });
    const program = `
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openOwnership} = await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/public.ts'))});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/contracts.ts'))});
const {applyPlans}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/public.ts'))});
const {planRestoration}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/contracts.ts'))});
let log = openOwnership(process.cwd());
try {
    const [first] = applyPlans(log, [planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed bytes'), mode: 0o755}, kind: 'tool_file', canReplace: true})]);
    const [repeated] = applyPlans(log, [planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed bytes'), mode: 0o755}, kind: 'tool_file'})]);
    log[Symbol.dispose]();
    log = openOwnership(process.cwd());
    const [restored] = applyPlans(log, [planRestoration(log, 'config.txt')]);
    console.log(JSON.stringify({first, repeated, restored, isRemoved: log.files.read('config.txt') === undefined}));
} finally {log[Symbol.dispose]();}
`;
    const child = runTestCommandBlocking([process.execPath, '-e', program], { cwd: directory.path });
    expect(child.code, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toStrictEqual({
        first: 'changed',
        repeated: 'unchanged',
        restored: 'changed',
        isRemoved: true,
    });
});

test('a replaced file keeps no copy, and giving it back deletes it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored\n' });
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            planReplacement(log, {
                path: 'config.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'tool_file',
                canReplace: true,
            }),
        ]);
        expect(await readdir(join(directory.path, '.gspot/state'))).toContain('ownership.json');
        expect(applyPlans(log, [planRestoration(log, 'config.txt')])[0]).toBe('changed');
    }
    expect(await pathExists(join(directory.path, 'config.txt'))).toBe(false);
});
