import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { hasPackages } from '#cli/prose/vale.ts';
import { openSession } from '#cli/run/session.ts';

test('generated vocabulary combines shipped and project words without duplicates', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["prose"]\n[prose]\nvocabulary = ["NebulaKit", "TypeScript", "NebulaKit"]\n',
    });
    const output = emitAll(await openSession(sandbox.path));
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
    expect(hasPackages(sandbox.path, true)).toBe(false);
    const owner = openLifecycleOwner(sandbox.path);
    try {
        owner.replace(
            '.gspot/config/vale/styles/Google/terms.yml',
            { bytes: Buffer.from('extends: existence\n'), mode: 0o644 },
            'config',
        );
    } finally {
        owner.close();
    }
    expect(hasPackages(sandbox.path, true)).toBe(true);
    writeFileSync(join(sandbox.path, '.gspot/config/vale/styles/Google/terms.yml'), 'edited\n');
    expect(hasPackages(sandbox.path, true)).toBe(false);
});

test('a Vale configuration without external packages needs no downloaded styles', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = \n' });
    expect(hasPackages(sandbox.path)).toBe(true);
});
