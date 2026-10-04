import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { applyBlock } from '#cli/platform/managed-blocks.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { statSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { proposeBlock, proposeMerge } from '#cli/lifecycle/ownership/plans.ts';

test('managed block updates and removal preserve authored bytes and subsequent surrounding edits', async () => {
    await using directory = await testdir();
    const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(directory.path, { 'AGENTS.md': original });
    let log = openOwnership(directory.path);
    try {
        expect(applyPlan(log, proposeBlock(log, 'AGENTS.md', 'first instructions', 'markdown'))).toBe('changed');
        const installed = log.files.read('AGENTS.md')!.bytes.toString('utf8');
        expect(installed.startsWith(original)).toBe(true);
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        writeFileSync(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
        expect(applyPlan(log, proposeBlock(log, 'AGENTS.md', 'updated instructions', 'markdown'))).toBe('changed');
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
            prefix + applyBlock(original, 'updated instructions', 'markdown') + suffix,
        );
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlan(log, proposeRestoration(log, 'AGENTS.md'))).toBe('changed');
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
    } finally {
        log[Symbol.dispose]();
    }
});

test('removing a block restores an originally empty file instead of deleting it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'AGENTS.md': '' });
    {
        using log = openOwnership(directory.path);

        expect(applyPlan(log, proposeBlock(log, 'AGENTS.md', 'instructions', 'markdown'))).toBe('changed');
        expect(applyPlan(log, proposeRestoration(log, 'AGENTS.md'))).toBe('changed');
        expect(log.files.read('AGENTS.md')?.bytes).toStrictEqual(Buffer.alloc(0));
    }
});

test('shared TOML updates preserve comments and later authored settings through removal', async () => {
    await using directory = await testdir();
    const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(directory.path, { 'compiler.toml': original });
    let log = openOwnership(directory.path);
    try {
        expect(
            applyPlan(
                log,
                proposeMerge(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/first.json' }], true),
            ),
        ).toBe('changed');
        const installed = log.files.read('compiler.toml')!.bytes.toString('utf8');
        const edited = installed.replace('strict = false', 'strict = true');
        writeFileSync(join(directory.path, 'compiler.toml'), edited);
        expect(
            applyPlan(log, proposeMerge(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/second.json' }])),
        ).toBe('changed');
        expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
            edited.replace('./.gspot/first.json', './.gspot/second.json'),
        );
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlan(log, proposeRestoration(log, 'compiler.toml'))).toBe('changed');
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
            proposeMerge(
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
        writeFileSync(join(directory.path, 'package.toml'), edited);
        expect(
            applyPlan(log, proposeMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }])),
        ).toBe('changed');
        expect(log.files.read('package.toml')!.bytes.toString('utf8')).toBe(
            original.replace('private = true', 'private = false'),
        );
        expect(applyPlan(log, proposeRestoration(log, 'package.toml'))).toBe('changed');
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
                proposeMerge(
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
        writeFileSync(join(directory.path, 'tool.toml'), edited);
        expect(
            applyPlan(
                log,
                proposeMerge(log, 'tool.toml', [
                    { path: ['checks', 'commands', 'gspot'], value: { run: 'gspot check --staged --verbose' } },
                ]),
            ),
        ).toBe('changed');
        expect(log.files.read('tool.toml')!.bytes.toString('utf8')).toContain('echo authored-later');
        expect(applyPlan(log, proposeRestoration(log, 'tool.toml'))).toBe('changed');
        expect(log.files.read('tool.toml')!.bytes.toString('utf8')).toBe(
            original.replace('echo original', 'echo authored-later'),
        );
    }
});

test('adopting identical authored configuration restores its bytes and permissions', async () => {
    await using directory = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(directory.path, { 'package.toml': content });
    chmodSync(join(directory.path, 'package.toml'), 0o640);
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            proposeMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }], true),
        ]);
        expect(applyPlan(log, proposeRestoration(log, 'package.toml'))).toBe('changed');
        expect(readFileSync(join(directory.path, 'package.toml'), 'utf8')).toBe(content);
        expect(statSync(join(directory.path, 'package.toml')).mode & 0o777).toBe(getKeptMode(0o640));
    }
});

test('identical unrecorded blocks and configuration fields survive adoption, later edits, and restoration', async () => {
    await using directory = await testdir();
    const instructions = applyBlock('Authored instructions.\n', 'existing instructions', 'markdown');
    const configuration = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(directory.path, { 'AGENTS.md': instructions, 'package.toml': configuration });
    {
        using log = openOwnership(directory.path);

        applyPlans(log, [
            proposeBlock(log, 'AGENTS.md', 'existing instructions', 'markdown'),
            proposeMerge(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
        ]);
        writeFileSync(join(directory.path, 'AGENTS.md'), instructions + 'Later authored instructions.\n');
        writeFileSync(join(directory.path, 'package.toml'), configuration.replace('true', 'false'));
        applyPlans(
            log,
            ['AGENTS.md', 'package.toml'].map((path) => proposeRestoration(log, path)),
        );
        expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(
            instructions + 'Later authored instructions.\n',
        );
        expect(readFileSync(join(directory.path, 'package.toml'), 'utf8')).toBe(configuration.replace('true', 'false'));
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
        applyPlan(log, proposeMerge(log, path, fields, true));
        const installed = log.files.read(path)!.bytes.toString('utf8');
        const edited = installed.replace('4', '99');
        writeFileSync(join(directory.path, path), edited);
        expect(applyPlan(log, proposeMerge(log, path, []))).toBe('preserved');
        expect(log.files.read(path)!.bytes.toString('utf8')).toBe(edited);
        writeFileSync(join(directory.path, path), installed);
        applyPlan(log, proposeMerge(log, path, [fields[1]!]));
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({
            authored: true,
            kept: {},
            created: { nested: { second: 2 } },
        });
        applyPlan(log, proposeMerge(log, path, []));
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: true, kept: {} });
        applyPlan(log, proposeMerge(log, path, fields, true));
        writeFileSync(
            join(directory.path, path),
            log.files.read(path)!.bytes.toString('utf8').replace('true', 'false'),
        );
        expect(applyPlan(log, proposeRestoration(log, path))).toBe('changed');
        expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: false, kept: {} });
    } finally {
        log[Symbol.dispose]();
    }
});
