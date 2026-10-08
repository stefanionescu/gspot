import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { VALE_PACKAGES } from '#cli/config/tools/vale.ts';

test('generated vocabulary combines shipped and project words without duplicates', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Sample\n',
        'gspot.toml': buildPolicy(['prose'], {
            tables: '[words]\nNebulaConfiguration = "The configuration has this product name."\nTypeScript = "TypeScript"\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const vocabulary = output.files.find(
        (file) => file.path === '.gspot/config/vale/styles/config/vocabularies/words/accept.txt',
    )!;
    const words = vocabulary.content.trimEnd().split('\n');
    expect(words).toContain('TypeScript');
    expect(words).toContain('NebulaConfiguration');
    expect(words.filter((word) => word === 'NebulaConfiguration')).toHaveLength(1);
    expect(words.filter((word) => word === 'TypeScript')).toHaveLength(1);
    expect(vocabulary.content.endsWith('\n')).toBe(true);
});

test.each(['recommended', 'all'] as const)(
    '%s generates the portable prose style and current link-text selection',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'sample.md': '# Sample\n',
            'gspot.toml': buildPolicy(['prose'], { level }),
        });
        gitOutput(sandbox.path, ['init', '-q']);
        const output = emitAll(await openSession(sandbox.path));
        const paths = new Set(output.files.map((file) => file.path));
        expect(paths.has('.gspot/config/vale/styles/gspot/defaults.yml')).toBe(false);
        expect(paths.has('.gspot/config/vale/styles/gspot/link-text.yml')).toBe(true);
        const configuration = output.files.find((file) => file.path === '.gspot/config/vale.ini')!;
        expect(configuration.content).not.toContain('gspot.link-text = NO');
        expect(configuration.content).not.toContain('gspot.defaults');
        expect(configuration.content.includes(`Packages = ${VALE_PACKAGES.join(', ')}`)).toBe(level === 'all');
        expect(configuration.content).toContain(
            `BasedOnStyles = ${level === 'all' ? ['Vale', 'gspot', ...VALE_PACKAGES].join(', ') : 'gspot'}`,
        );
        expect(output.blocks.find((block) => block.path === '.gitignore')!.block).not.toContain('styles/Readability/');
    },
);
