import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { pathExists } from '#tests/harness/preservation.ts';
import { getCliSourcePath } from '#tests/harness/process.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { planMerge } from '#cli/lifecycle/ownership/plans.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { rm, symlink, readFile, writeFile } from 'node:fs/promises';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/installations.ts';
import { TASK_RESTORATION_CASES } from '#tests/config/cli/lifecycle/ownership/replacement-preservation.ts';

const implementation = getCliSourcePath('lifecycle/ownership/log.ts');

test.each(TASK_RESTORATION_CASES)(
    'TOML task ownership restores original tasks with $name',
    async ({ appended, environment, isOriginal }) => {
        await using directory = await testdir();
        const original =
            '# Authored tasks\n[tasks]\nlint = "authored lint"\n[tasks.format]\n# Keep this description\ndescription = "Format the app"\nrun = ["authored format", "authored verify"]\n';
        await createFileTree(directory.path, { 'mise.toml': original });
        {
            using log = openOwnership(directory.path);

            const changes = [
                { path: ['tasks', 'lint'], value: 'gspot check' },
                { path: ['tasks', 'format', 'run'], value: 'gspot check --fix' },
            ];
            expect(applyPlan(log, planMerge(log, 'mise.toml', changes, true))).toBe('changed');
            const installed = await readFile(join(directory.path, 'mise.toml'), 'utf8');
            expect(installed).toContain('# Authored tasks');
            expect(installed).toContain('# Keep this description');
            expect(parseToml(installed)).toMatchObject({
                tasks: { lint: 'gspot check', format: { description: 'Format the app', run: 'gspot check --fix' } },
            });
            expect(applyPlan(log, planMerge(log, 'mise.toml', changes))).toBe('unchanged');
            await writeFile(join(directory.path, 'mise.toml'), installed + appended);
            expect(applyPlan(log, planRestoration(log, 'mise.toml'))).toBe('changed');
            const restored = await readFile(join(directory.path, 'mise.toml'), 'utf8');
            expect(parseToml(restored)['tasks']).toStrictEqual(parseToml(original)['tasks']);
            // An authored edit survives the restore; without one the file is byte for byte the original.
            expect(parseToml(restored)['env']).toStrictEqual(environment);
            expect(restored === original).toBe(isOriginal);
        }
    },
);

test('Windows permission projection supports repeated log writes, idempotent replacement, and removal', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.txt': 'authored bytes' });
    const program = `
Object.defineProperty(process, 'platform', {value: 'win32'});
const {openOwnership} = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/plans.ts'))});
const {applyPlan}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/commit.ts'))});
const {planRestoration}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/restoration.ts'))});
let log = openOwnership(process.cwd());
try {
    const first = applyPlan(log, planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed bytes'), mode: 0o755}, kind: 'config', canReplace: true}));
    const repeated = applyPlan(log, planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed bytes'), mode: 0o755}, kind: 'config'}));
    log[Symbol.dispose]();
    log = openOwnership(process.cwd());
    const restored = applyPlan(log, planRestoration(log, 'config.txt'));
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

test('a Python installation replaces the whole environment, runtime caches included, as one record', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    const cache = '.gspot/.venv/lib/__pycache__';
    await createFileTree(staged.path, {
        'lib/package.py': 'value = 2\n',
        'lib/package.pyc': 'packaged legacy bytecode',
        'lib/__pycache__/new.pyc': 'temporary new bytecode',
    });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'python', readInstalledTree(staged.path, 'python'));
        await createFileTree(directory.path, { [`${cache}/unowned.pyc`]: 'runtime bytes' });
        installTree(log, 'python', readInstalledTree(staged.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 2\n');
        expect(log.files.read('.gspot/.venv/lib/package.pyc')?.bytes.toString()).toBe('packaged legacy bytecode');
        // Runtime caches leave with the old environment; the staged caches are never published.
        expect(await pathExists(join(directory.path, `${cache}/unowned.pyc`))).toBe(false);
        expect(await pathExists(join(directory.path, `${cache}/new.pyc`))).toBe(false);
        expect(getOwnership(directory.path)).toStrictEqual({ version: 1, files: [], installed: ['python'] });
    }
});
describe.if(isPosix)('lifecycle ownership', () => {
    test('an installation replaces the folder it owns whole, edits and obsolete files included', async () => {
        await using directory = await testdir();
        await using staged = await testdir();
        await createFileTree(staged.path, { 'package/bin/tool': 'new executable', '.bin/.keep': '', obsolete: 'old' });
        await symlink('../package/bin/tool', join(staged.path, '.bin/tool'));
        {
            using log = openOwnership(directory.path);

            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
            await writeFile(join(directory.path, '.gspot/node_modules/obsolete'), 'hand edit');
            await rm(join(staged.path, 'obsolete'));
            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
            expect(await readFile(join(directory.path, '.gspot/node_modules/.bin/tool'), 'utf8')).toBe(
                'new executable',
            );
            expect(await pathExists(join(directory.path, '.gspot/node_modules/obsolete'))).toBe(false);
            expect(await pathExists(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
            expect(await pathExists(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
        }
    });
});
