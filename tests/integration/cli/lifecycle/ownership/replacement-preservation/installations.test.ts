import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cliSource } from '#tests/harness/cli/process.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { openOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { rmSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const implementation = cliSource('lifecycle/ownership/owner.ts');

test.each([false, true])(
    'TOML task ownership restores originals while retaining unrelated edits (%s)',
    async (edited) => {
        await using directory = await testdir();
        const original =
            '# Authored tasks\n[tasks]\nlint = "authored lint"\n[tasks.format]\n# Keep this description\ndescription = "Format the app"\nrun = ["authored format", "authored verify"]\n';
        await createFileTree(directory.path, { 'mise.toml': original });
        const owner = openOwner(directory.path);
        try {
            const changes = [
                { path: ['tasks', 'lint'], value: 'gspot check' },
                { path: ['tasks', 'format', 'run'], value: 'gspot check --fix' },
            ];
            expect(owner.applyPlan(owner.proposeConfiguration('mise.toml', 'toml', changes, true))).toBe('changed');
            const installed = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
            expect(installed).toContain('# Authored tasks');
            expect(installed).toContain('# Keep this description');
            expect(parseToml(installed)).toMatchObject({
                tasks: { lint: 'gspot check', format: { description: 'Format the app', run: 'gspot check --fix' } },
            });
            expect(owner.applyPlan(owner.proposeConfiguration('mise.toml', 'toml', changes))).toBe('unchanged');
            if (edited)
                writeFileSync(join(directory.path, 'mise.toml'), installed + '\n[env]\nAPP_MODE = "authored"\n');
            expect(owner.applyPlan(owner.proposeRestoration('mise.toml'))).toBe('changed');
            const restored = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
            expect(parseToml(restored)['tasks']).toStrictEqual(parseToml(original)['tasks']);
            // An authored edit survives the restore; without one the file is byte for byte the original.
            expect(parseToml(restored)['env']).toStrictEqual(edited ? { APP_MODE: 'authored' } : undefined);
            expect(restored === original).toBe(!edited);
        } finally {
            owner.close();
        }
    },
);

test('Windows permission projection supports repeated log writes, idempotent replacement, and removal', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored bytes' });
    const program = `
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openOwner} = await import(${JSON.stringify(implementation)});
let owner = openOwner(process.cwd());
try {
    const first = owner.replace('config.txt', {bytes: Buffer.from('installed bytes'), mode: 0o755}, 'config', true);
    const repeated = owner.replace('config.txt', {bytes: Buffer.from('installed bytes'), mode: 0o755}, 'config');
    owner.close();
    owner = openOwner(process.cwd());
    const restored = owner.applyPlan(owner.proposeRestoration('config.txt'));
    console.log(JSON.stringify({first, repeated, restored, isRemoved: owner.read('config.txt') === undefined}));
} finally {owner.close();}
`;
    const child = Bun.spawnSync([process.execPath, '-e', program], {
        cwd: directory.path,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    expect(JSON.parse(child.stdout.toString())).toStrictEqual({
        first: 'changed',
        repeated: 'unchanged',
        restored: 'changed',
        isRemoved: true,
    });
});

test('a Python installation replaces the whole environment, runtime caches included, as one record', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    const cache = '.gspot/.venv/lib/__pycache__';
    await createFileTree(staged.path, {
        'lib/package.py': 'value = 2\n',
        'lib/package.pyc': 'packaged legacy bytecode',
        'lib/__pycache__/new.pyc': 'temporary new bytecode',
    });
    const owner = openOwner(directory.path);
    try {
        owner.installTree('python', installedOutputs(staged.path, 'python'));
        await createFileTree(directory.path, { [`${cache}/unowned.pyc`]: 'runtime bytes' });
        owner.installTree('python', installedOutputs(staged.path, 'python'));
        expect(owner.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 2\n');
        expect(owner.read('.gspot/.venv/lib/package.pyc')?.bytes.toString()).toBe('packaged legacy bytecode');
        // Runtime caches leave with the old environment; the staged caches are never published.
        expect(existsSync(join(directory.path, `${cache}/unowned.pyc`))).toBe(false);
        expect(existsSync(join(directory.path, `${cache}/new.pyc`))).toBe(false);
        expect(readOwnership(directory.path)).toStrictEqual({ version: 1, files: [], installs: ['python'] });
    } finally {
        owner.close();
    }
});
describe.if(onPosix)('lifecycle ownership', () => {
    test('an installation replaces the folder it owns whole, edits and obsolete files included', async () => {
        await using directory = await testdir();
        await using staged = await testdir();
        await createFileTree(staged.path, { 'package/bin/tool': 'new executable', '.bin/.keep': '', obsolete: 'old' });
        symlinkSync('../package/bin/tool', join(staged.path, '.bin/tool'));
        const owner = openOwner(directory.path);
        try {
            owner.installTree('npm', installedOutputs(staged.path, 'npm'));
            writeFileSync(join(directory.path, '.gspot/node_modules/obsolete'), 'hand edit');
            rmSync(join(staged.path, 'obsolete'));
            owner.installTree('npm', installedOutputs(staged.path, 'npm'));
            expect(readFileSync(join(directory.path, '.gspot/node_modules/.bin/tool'), 'utf8')).toBe('new executable');
            expect(existsSync(join(directory.path, '.gspot/node_modules/obsolete'))).toBe(false);
            expect(existsSync(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
            expect(existsSync(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
        } finally {
            owner.close();
        }
    });
});
