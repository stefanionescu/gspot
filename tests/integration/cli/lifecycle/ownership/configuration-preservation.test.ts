import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership/owner.ts';
import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';

test('managed block updates and removal preserve authored bytes and subsequent surrounding edits', async () => {
    await using directory = await testdir();
    const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(directory.path, { 'AGENTS.md': original });
    let owner = openLifecycleOwner(directory.path);
    try {
        expect(owner.replaceBlock('AGENTS.md', 'first instructions', 'markdown')).toBe('changed');
        const installed = owner.read('AGENTS.md')!.bytes.toString('utf8');
        expect(installed.startsWith(original)).toBe(true);
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        writeFileSync(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
        expect(owner.replaceBlock('AGENTS.md', 'updated instructions', 'markdown')).toBe('changed');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
            prefix + applyBlock(original, 'updated instructions', 'markdown') + suffix,
        );
        owner.close();
        owner = openLifecycleOwner(directory.path);
        expect(owner.restore('AGENTS.md')).toBe('changed');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
    } finally {
        owner.close();
    }
});

test('removing a block restores an originally empty file instead of deleting it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'AGENTS.md': '' });
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(owner.replaceBlock('AGENTS.md', 'instructions', 'markdown')).toBe('changed');
        expect(owner.restore('AGENTS.md')).toBe('changed');
        expect(owner.read('AGENTS.md')?.bytes).toStrictEqual(Buffer.alloc(0));
    } finally {
        owner.close();
    }
});

test('shared JSON updates preserve comments and later authored settings through uninstall', async () => {
    await using directory = await testdir();
    const original =
        '{\n  // Keep this comment.\n  "extends": "./authored.json",\n  "compilerOptions": { "strict": false }\n}\n';
    await createFileTree(directory.path, { 'tsconfig.json': original });
    let owner = openLifecycleOwner(directory.path);
    try {
        expect(
            owner.applyProposal(
                owner.proposeConfiguration(
                    'tsconfig.json',
                    'json',
                    [{ path: ['extends'], value: './.gspot/first.json' }],
                    true,
                ),
            ),
        ).toBe('changed');
        const installed = owner.read('tsconfig.json')!.bytes.toString('utf8');
        const edited = installed.replace('"strict": false', '"strict": true');
        writeFileSync(join(directory.path, 'tsconfig.json'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('tsconfig.json', 'json', [
                    { path: ['extends'], value: './.gspot/second.json' },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(
            edited.replace('./.gspot/first.json', './.gspot/second.json'),
        );
        owner.close();
        owner = openLifecycleOwner(directory.path);
        expect(owner.restore('tsconfig.json')).toBe('changed');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(
            original.replace('"strict": false', '"strict": true'),
        );
    } finally {
        owner.close();
    }
});

test('leaving JSON keys restores their original values and preserves authored changes', async () => {
    await using directory = await testdir();
    const original = '{"scripts":{"prepare":"build-app","check":"gspot check"},"optional":null,"private":true}\n';
    await createFileTree(directory.path, { 'package.json': original });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposal(
            owner.proposeConfiguration(
                'package.json',
                'json',
                [
                    { path: ['scripts', 'prepare'], value: 'gspot apply' },
                    { path: ['scripts', 'check'], value: 'gspot check' },
                    { path: ['optional'], value: true },
                ],
                true,
            ),
        );
        const edited = owner.read('package.json')!.bytes.toString('utf8').replace('"private":true', '"private":false');
        writeFileSync(join(directory.path, 'package.json'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('package.json', 'json', [
                    { path: ['scripts', 'check'], value: 'gspot check' },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('package.json')!.bytes.toString('utf8')).toBe(
            original.replace('"private":true', '"private":false'),
        );
        expect(owner.restore('package.json')).toBe('changed');
        expect(owner.read('package.json')!.bytes.toString('utf8')).toBe(
            original.replace('"private":true', '"private":false'),
        );
    } finally {
        owner.close();
    }
});

test('Lefthook YAML ownership preserves authored commands and comments through updates and removal', async () => {
    await using directory = await testdir();
    const original = '# Keep this hook.\npre-commit:\n  commands:\n    authored:\n      run: echo original\n';
    await createFileTree(directory.path, { 'lefthook.yml': original });
    const owner = openLifecycleOwner(directory.path);
    try {
        expect(
            owner.applyProposal(
                owner.proposeConfiguration(
                    'lefthook.yml',
                    'yaml',
                    [{ path: ['pre-commit', 'commands', 'gspot'], value: { run: 'gspot check --staged' } }],
                    true,
                ),
            ),
        ).toBe('changed');
        const edited = owner
            .read('lefthook.yml')!
            .bytes.toString('utf8')
            .replace('echo original', 'echo authored-later');
        writeFileSync(join(directory.path, 'lefthook.yml'), edited);
        expect(
            owner.applyProposal(
                owner.proposeConfiguration('lefthook.yml', 'yaml', [
                    { path: ['pre-commit', 'commands', 'gspot'], value: { run: 'gspot check --staged --no-cache' } },
                ]),
            ),
        ).toBe('changed');
        expect(owner.read('lefthook.yml')!.bytes.toString('utf8')).toContain('echo authored-later');
        expect(owner.restore('lefthook.yml')).toBe('changed');
        expect(owner.read('lefthook.yml')!.bytes.toString('utf8')).toBe(
            original.replace('echo original', 'echo authored-later'),
        );
    } finally {
        owner.close();
    }
});

test('adopting identical authored configuration retains original recovery bytes and permissions', async () => {
    await using directory = await testdir();
    const content = '{\n    "scripts": {"check": "gspot check"},\n    "authored": true\n}\n';
    await createFileTree(directory.path, { 'package.json': content });
    chmodSync(join(directory.path, 'package.json'), 0o640);
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposals([
            owner.proposeConfiguration(
                'package.json',
                'json',
                [{ path: ['scripts', 'check'], value: 'gspot check' }],
                true,
            ),
        ]);
        const state = ownershipSchema.parse(
            JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
        );
        const original = state.files[0]!.original;
        expect(original).toBeDefined();
        expect(readFileSync(join(directory.path, original!.backup), 'utf8')).toBe(content);
        expect(owner.restore('package.json')).toBe('changed');
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(content);
        expect(statSync(join(directory.path, 'package.json')).mode & 0o777).toBe(0o640);
    } finally {
        owner.close();
    }
});

test('identical unrecorded blocks and configuration fields survive adoption, later edits, and restoration', async () => {
    await using directory = await testdir();
    const instructions = applyBlock('Authored instructions.\n', 'existing instructions', 'markdown');
    const configuration = '{"scripts":{"check":"gspot check"},"authored":true}\n';
    await createFileTree(directory.path, { 'AGENTS.md': instructions, 'package.json': configuration });
    const owner = openLifecycleOwner(directory.path);
    try {
        owner.applyProposals([
            owner.proposeBlock('AGENTS.md', 'existing instructions', 'markdown'),
            owner.proposeConfiguration('package.json', 'json', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
        ]);
        writeFileSync(join(directory.path, 'AGENTS.md'), instructions + 'Later authored instructions.\n');
        writeFileSync(join(directory.path, 'package.json'), configuration.replace('true', 'false'));
        owner.applyProposals(['AGENTS.md', 'package.json'].map((path) => owner.proposeRestoration(path)));
        expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(
            instructions + 'Later authored instructions.\n',
        );
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(configuration.replace('true', 'false'));
        expect(owner.paths()).toStrictEqual([]);
    } finally {
        owner.close();
    }
});

test.each([
    ['json', '{"authored":true,"kept":{}}\n', (text: string): unknown => JSON.parse(text)],
    ['yaml', 'authored: true\nkept: {}\n', (text: string): unknown => parseYaml(text)],
    ['toml', 'authored = true\n[kept]\n', (text: string): unknown => parseToml(text)],
] as const)(
    'shared %s configuration removes created empty parents and preserves authored empty parents',
    async (format, source, parse) => {
        await using directory = await testdir();
        const path = `config.${format}`;
        await createFileTree(directory.path, { [path]: source });
        const owner = openLifecycleOwner(directory.path);
        const fields = [
            { path: ['created', 'nested', 'first'], value: 1 },
            { path: ['created', 'nested', 'second'], value: 2 },
            { path: ['created', 'nested', 'third'], value: 3 },
            { path: ['created', 'nested', 'fourth'], value: 4 },
            { path: ['kept', 'owned'], value: true },
        ];
        try {
            owner.applyProposal(owner.proposeConfiguration(path, format, fields, true));
            const installed = owner.read(path)!.bytes.toString('utf8');
            const edited = installed.replace('4', '99');
            writeFileSync(join(directory.path, path), edited);
            expect(owner.applyProposal(owner.proposeConfiguration(path, format, []))).toBe('preserved');
            expect(owner.read(path)!.bytes.toString('utf8')).toBe(edited);
            writeFileSync(join(directory.path, path), installed);
            owner.applyProposal(owner.proposeConfiguration(path, format, [fields[1]!]));
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toStrictEqual({
                authored: true,
                kept: {},
                created: { nested: { second: 2 } },
            });
            owner.applyProposal(owner.proposeConfiguration(path, format, []));
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: true, kept: {} });
            owner.applyProposal(owner.proposeConfiguration(path, format, fields, true));
            writeFileSync(
                join(directory.path, path),
                owner.read(path)!.bytes.toString('utf8').replace('true', 'false'),
            );
            expect(owner.restore(path)).toBe('changed');
            expect(parse(owner.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: false, kept: {} });
        } finally {
            owner.close();
        }
    },
);
