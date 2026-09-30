import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { hasPackages } from '#cli/tools/vale.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

test('generated vocabulary combines shipped and project words without duplicates', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['prose'], '[prose]\nvocabulary = ["NebulaKit", "TypeScript", "NebulaKit"]\n'),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const vocabulary = output.files.find(
        (file) => file.path === '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt',
    )!;
    const words = vocabulary.content.trimEnd().split('\n');
    expect(words).toContain('TypeScript');
    expect(words).toContain('NebulaKit');
    expect(words.filter((word) => word === 'NebulaKit')).toHaveLength(1);
    expect(words.filter((word) => word === 'TypeScript')).toHaveLength(1);
    expect(vocabulary.content.endsWith('\n')).toBe(true);
});

test('package readiness follows the generated Vale configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = Google\n' });
    expect(hasPackages(sandbox.path)).toBe(false);
    mkdirSync(join(sandbox.path, '.gspot/config/vale/styles/Google'), { recursive: true });
    expect(hasPackages(sandbox.path)).toBe(true);
});

test('a Vale configuration without external packages needs no downloaded styles', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = \n' });
    expect(hasPackages(sandbox.path)).toBe(true);
});
