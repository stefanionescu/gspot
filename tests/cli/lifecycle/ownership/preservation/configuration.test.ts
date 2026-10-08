import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { applyBlock } from '#cli/platform/managed-blocks.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { planBlock, planMerge } from '#cli/lifecycle/ownership/plans.ts';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { MALFORMED_BLOCKS } from '#tests/config/cli/platform/managed-blocks.ts';
import { TASK_RESTORATION_CASES } from '#tests/config/cli/lifecycle/ownership/preservation/configuration.ts';

test('shared TOML updates preserve comments and later authored settings through removal', async () => {
    await using directory = await testdir();
    const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(directory.path, { 'compiler.toml': original });
    let log = openOwnership(directory.path);
    try {
        expect(
            applyPlan(
                log,
                planMerge(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/first.json' }], true),
            ),
        ).toBe('changed');
        const installed = log.files.read('compiler.toml')!.bytes.toString('utf8');
        const edited = installed.replace('strict = false', 'strict = true');
        await writeFile(join(directory.path, 'compiler.toml'), edited);
        expect(
            applyPlan(log, planMerge(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/second.json' }])),
        ).toBe('changed');
        expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
            edited.replace('./.gspot/first.json', './.gspot/second.json'),
        );
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlan(log, planRestoration(log, 'compiler.toml'))).toBe('changed');
        expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
            original.replace('strict = false', 'strict = true'),
        );
    } finally {
        log[Symbol.dispose]();
    }
});

test('leaving TOML keys restores their original values and preserves authored changes', async () => {
    await using directory = await testdir();
    const original = 'private = true\noptional = true\n[scripts]\nprepare = "build-app"\ncheck = "gspot check"\n';
    await createFileTree(directory.path, { 'package.toml': original });
    {
        using log = openOwnership(directory.path);

        applyPlan(
            log,
            planMerge(
                log,
                'package.toml',
                [
                    { path: ['scripts', 'prepare'], value: 'gspot apply' },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                    { path: ['optional'], value: false },
                ],
                true,
            ),
        );
        const edited = log.files
            .read('package.toml')!
            .bytes.toString('utf8')
            .replace('private = true', 'private = false');
        await writeFile(join(directory.path, 'package.toml'), edited);
        expect(
            applyPlan(log, planMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }])),
        ).toBe('changed');
        expect(log.files.read('package.toml')!.bytes.toString('utf8')).toBe(
            original.replace('private = true', 'private = false'),
        );
        expect(applyPlan(log, planRestoration(log, 'package.toml'))).toBe('changed');
        expect(log.files.read('package.toml')!.bytes.toString('utf8')).toBe(
            original.replace('private = true', 'private = false'),
        );
    }
});

test('nested TOML ownership preserves authored entries and comments through updates and removal', async () => {
    await using directory = await testdir();
    const original = '# Keep this entry.\n[checks.commands.authored]\nrun = "echo original"\n';
    await createFileTree(directory.path, { 'tool.toml': original });
    {
        using log = openOwnership(directory.path);

        expect(
            applyPlan(
                log,
                planMerge(
                    log,
                    'tool.toml',
                    [{ path: ['checks', 'commands', 'gspot'], value: { run: 'gspot check --staged' } }],
                    true,
                ),
            ),
        ).toBe('changed');
        const edited = log.files
            .read('tool.toml')!
            .bytes.toString('utf8')
            .replace('echo original', 'echo authored-later');
        await writeFile(join(directory.path, 'tool.toml'), edited);
        expect(
            applyPlan(
                log,
                planMerge(log, 'tool.toml', [
                    { path: ['checks', 'commands', 'gspot'], value: { run: 'gspot check --staged --verbose' } },
                ]),
            ),
        ).toBe('changed');
        expect(log.files.read('tool.toml')!.bytes.toString('utf8')).toContain('echo authored-later');
        expect(applyPlan(log, planRestoration(log, 'tool.toml'))).toBe('changed');
        expect(log.files.read('tool.toml')!.bytes.toString('utf8')).toBe(
            original.replace('echo original', 'echo authored-later'),
        );
    }
});

test('adopting identical authored configuration restores its bytes and permissions', async () => {
    await using directory = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(directory.path, { 'package.toml': content });
    await chmod(join(directory.path, 'package.toml'), 0o640);
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [planMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }], true)]);
        expect(applyPlan(log, planRestoration(log, 'package.toml'))).toBe('changed');
        expect(await readFile(join(directory.path, 'package.toml'), 'utf8')).toBe(content);
        const metadata = await stat(join(directory.path, 'package.toml'));
        expect(metadata.mode & 0o777).toBe(getKeptMode(0o640));
    }
});

test('identical unrecorded blocks and configuration fields survive adoption, later edits, and restoration', async () => {
    await using directory = await testdir();
    const instructions = applyBlock('Authored instructions.\n', 'existing instructions', {
        path: 'AGENTS.md',
        style: 'markdown',
    });
    const configuration = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(directory.path, { 'AGENTS.md': instructions, 'package.toml': configuration });
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            planBlock(log, 'AGENTS.md', 'existing instructions', 'markdown'),
            planMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
        ]);
        await writeFile(join(directory.path, 'AGENTS.md'), instructions + 'Later authored instructions.\n');
        await writeFile(join(directory.path, 'package.toml'), configuration.replace('true', 'false'));
        applyPlans(
            log,
            ['AGENTS.md', 'package.toml'].map((path) => planRestoration(log, path)),
        );
        expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(
            instructions + 'Later authored instructions.\n',
        );
        expect(await readFile(join(directory.path, 'package.toml'), 'utf8')).toBe(
            configuration.replace('true', 'false'),
        );
        expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
    }
});

test('shared TOML removes created empty parents and preserves authored empty parents', async () => {
    const source = 'authored = true\n[kept]\n';
    await using directory = await testdir();
    const path = 'config.toml';
    await createFileTree(directory.path, { [path]: source });
    const log = openOwnership(directory.path);
    const fields = [
        { path: ['created', 'nested', 'first'], value: 1 },
        { path: ['created', 'nested', 'second'], value: 2 },
        { path: ['created', 'nested', 'third'], value: 3 },
        { path: ['created', 'nested', 'fourth'], value: 4 },
        { path: ['kept', 'owned'], value: true },
    ];
    try {
        applyPlan(log, planMerge(log, path, fields, true));
        const installed = log.files.read(path)!.bytes.toString('utf8');
        const edited = installed.replace('4', '99');
        await writeFile(join(directory.path, path), edited);
        expect(applyPlan(log, planMerge(log, path, []))).toBe('preserved');
        expect(log.files.read(path)!.bytes.toString('utf8')).toBe(edited);
        await writeFile(join(directory.path, path), installed);
        applyPlan(log, planMerge(log, path, [fields[1]!]));
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({
            authored: true,
            kept: {},
            created: { nested: { second: 2 } },
        });
        applyPlan(log, planMerge(log, path, []));
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: true, kept: {} });
        applyPlan(log, planMerge(log, path, fields, true));
        await writeFile(
            join(directory.path, path),
            log.files.read(path)!.bytes.toString('utf8').replace('true', 'false'),
        );
        expect(applyPlan(log, planRestoration(log, path))).toBe('changed');
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: false, kept: {} });
    } finally {
        log[Symbol.dispose]();
    }
});

test.each(MALFORMED_BLOCKS)(
    'ownership refuses malformed $path without changing authored bytes or records: $source',
    async ({ path, style, source }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { [path]: source });
        using log = openOwnership(directory.path);
        const records = structuredClone(log.state);
        expect(() => planBlock(log, path, 'replacement', style)).toThrow(
            `${path} has incomplete or repeated gspot block markers.`,
        );
        expect(await readFile(join(directory.path, path), 'utf8')).toBe(source);
        expect(log.state).toStrictEqual(records);
    },
);

test('restoration names malformed files and preserves their bytes and ownership records', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'AGENTS.md': 'Authored instructions.\n',
        'bunfig.toml': '[install]\nexact = true\n',
    });
    using log = openOwnership(directory.path);
    applyPlans(log, [
        planBlock(log, 'AGENTS.md', 'instructions', 'markdown'),
        planMerge(log, 'bunfig.toml', [{ path: ['install', 'minimumReleaseAge'], value: 604_800 }], true),
    ]);
    const records = structuredClone(log.state);
    const instructions = log.files
        .read('AGENTS.md')!
        .bytes.toString('utf8')
        .replace('<!-- <<< gspot managed <<< -->', '');
    const toml = '[install\n';
    await writeFile(join(directory.path, 'AGENTS.md'), instructions);
    await writeFile(join(directory.path, 'bunfig.toml'), toml);
    expect(() => planRestoration(log, 'AGENTS.md')).toThrow(
        'AGENTS.md has incomplete or repeated gspot block markers.',
    );
    expect(() => planRestoration(log, 'bunfig.toml')).toThrow(
        'bunfig.toml is not valid TOML. Fix the file, then run gspot apply.',
    );
    expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(instructions);
    expect(await readFile(join(directory.path, 'bunfig.toml'), 'utf8')).toBe(toml);
    expect(log.state).toStrictEqual(records);
});

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
