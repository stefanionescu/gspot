import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { CONFIG } from '#tests/config/cli/generation/vale-packages.ts';
import { hasValePackages, removeValePackages } from '#cli/tools/vale.ts';
import { mkdirSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';

// A repository whose Vale configuration, package, or nested package folder links to a folder beside it.
async function linkedStyles(directory: string, kind: string): Promise<string> {
    await createFileTree(directory, {
        'project/.gspot/config/vale.ini': CONFIG,
        'project/.gspot/config/vale/styles/.keep': '',
        'outside/vale.ini': CONFIG,
        'outside/terms.yml': 'external bytes\n',
    });
    const root = join(directory, 'project');
    if (kind === 'configuration') {
        unlinkSync(join(root, '.gspot/config/vale.ini'));
        symlinkSync('../../outside/vale.ini', join(root, '.gspot/config/vale.ini'));
    } else if (kind === 'package') {
        symlinkSync('../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle'));
    } else {
        await createFileTree(root, { '.gspot/config/vale/styles/LocalStyle/.keep': '' });
        symlinkSync('../../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle/nested'));
    }
    return root;
}

test.each(['configuration', 'package'])(
    'Vale package detection rejects a linked %s without reading outside styles',
    async (kind) => {
        await using directory = await testdir();
        const root = await linkedStyles(directory.path, kind);
        expect(() => hasValePackages(root)).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
        expect(readFileSync(join(directory.path, 'outside/vale.ini'), 'utf8')).toBe(CONFIG);
    },
);

test.each(['package', 'nested directory'])(
    'Vale package removal refuses a linked %s without deleting outside styles',
    async (kind) => {
        await using directory = await testdir();
        const root = await linkedStyles(directory.path, kind);
        expect(() => {
            removeValePackages(root);
        }).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
    },
);

test('generated vocabulary combines shipped and project words without duplicates', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Sample\n',
        'gspot.toml': buildPolicy(['prose'], {
            tables: '[prose]\nvocabulary = ["NebulaConfiguration", "TypeScript", "NebulaConfiguration"]\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const vocabulary = output.files.find(
        (file) => file.path === '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt',
    )!;
    const words = vocabulary.content.trimEnd().split('\n');
    expect(words).toContain('TypeScript');
    expect(words).toContain('NebulaConfiguration');
    expect(words.filter((word) => word === 'NebulaConfiguration')).toHaveLength(1);
    expect(words.filter((word) => word === 'TypeScript')).toHaveLength(1);
    expect(vocabulary.content.endsWith('\n')).toBe(true);
});

test('package readiness follows the generated Vale configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = Google\n' });
    expect(hasValePackages(sandbox.path)).toBe(false);
    mkdirSync(join(sandbox.path, '.gspot/config/vale/styles/Google'), { recursive: true });
    expect(hasValePackages(sandbox.path)).toBe(true);
});

test('a Vale configuration without external packages needs no downloaded styles', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = \n' });
    expect(hasValePackages(sandbox.path)).toBe(true);
});
