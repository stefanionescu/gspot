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

test.each(['recommended', 'all'] as const)(
    '%s shares heading declarations and selects the scoped prose locale',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'sample.md': '# Table of contents\n',
            'british/sample.md': '# Guide\n',
            'british/american/sample.md': '# Guide\n',
            'gspot.toml': buildPolicy(['prose', 'spelling', 'docs'], {
                level,
                tables: '[docs]\nbanned_headings = ["Owner: [module]"]\n[scope.british.prose]\nlocale = "en-gb"\n[scope."british/american".prose]\nlocale = "en-us"\n',
            }),
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const style = output.files.find((file) => file.path.endsWith('/gspot/banned-headings.yml'))!.content;
        expect(style).toContain(String.raw`- (?:\b|^)${RegExp.escape('Owner: [module]')}(?:\b|$)`);
        expect(style).toContain(String.raw`- (?:\b|^)${RegExp.escape('source tree')}(?:\b|$)`);
        expect(style.toLowerCase()).not.toContain('table of contents');
        const vale = output.files.find((file) => file.path === '.gspot/config/vale.ini')!.content;
        expect(vale).toContain('[british/**]\ngspot.us-english = NO');
        expect(vale).toContain(`[british/american/**]\ngspot.us-english = ${level === 'all' ? 'YES' : 'NO'}`);
        const typos = output.files.filter((file) => file.path.endsWith('/typos.toml'));
        expect(typos.find((file) => file.path === '.gspot/config/british/typos.toml')!.content).toContain(
            'locale = "en-gb"',
        );
        expect(typos.find((file) => file.path === '.gspot/config/british/american/typos.toml')!.content).toContain(
            'locale = "en-us"',
        );
        expect(
            session.manifests
                .get('structure')!
                .settings.some((setting) => setting.name === 'limits.docs.sentence_words'),
        ).toBe(false);
        expect(
            session.manifests
                .get('prose')!
                .settings.filter((setting) => setting.name.startsWith('limits.docs.'))
                .map((setting) => setting.name),
        ).toStrictEqual([
            'limits.docs.sentence_words',
            'limits.docs.list_item_words',
            'limits.docs.paragraph_sentences',
        ]);
    },
);

test.each([
    ['scoped unsupported locale', '[scope.child.prose]\nlocale = "unsupported"\n'],
    ['retired tool locale', '[tools.typos]\nlocale = "en-gb"\n'],
] as const)('prose locale rejects %s', async (_name, tables) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose', 'spelling'], { tables }),
        'sample.md': '# Guide\n',
    });
    expect(openSession(sandbox.path)).rejects.toThrow('locale');
});

test.each(['recommended', 'all'] as const)(
    '%s emits effective scoped heading styles and shared search paths',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'sample.md': '# Root\n',
            'child/sample.md': '# Child\n',
            'child/deep/sample.md': '# Deep\n',
            'sibling/sample.md': '# Sibling\n',
            'gspot.toml': buildPolicy(['prose', 'docs'], {
                level,
                tables: '[docs]\nbanned_headings = ["Root"]\n[scope.child.docs]\nbanned_headings = ["Child"]\n[scope."child/deep"]\nconfigurations = ["prose"]\n[scope.sibling]\nconfigurations = ["prose"]\n',
            }),
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const root = output.files.find(({ path }) => path === '.gspot/config/vale.ini')!.content;
        expect(output.files.find(({ path }) => path === '.gspot/config/vale-scoped.ini')!.content).toBe(root);
        for (const scope of ['child', 'child/deep', 'sibling']) {
            const configuration = output.files.find(
                ({ path }) => path === `.gspot/config/${scope}/vale-scoped.ini`,
            )!.content;
            expect(configuration).toContain('StylesPath = vale/styles\nStylesPath = .gspot/config/vale/styles\n');
            const style = output.files.find(
                ({ path }) => path === `.gspot/config/${scope}/vale/styles/gspot/banned-headings.yml`,
            )!.content;
            expect(style).toContain(String.raw`- (?:\b|^)${RegExp.escape('Root')}(?:\b|$)`);
            expect(style.includes(String.raw`- (?:\b|^)${RegExp.escape('Child')}(?:\b|$)`)).toBe(
                scope.startsWith('child'),
            );
        }
        expect(
            output.files.find(({ path }) => path === '.gspot/config/vale/styles/gspot/banned-headings.yml')!.content,
        ).not.toContain(String.raw`- (?:\b|^)${RegExp.escape('Child')}(?:\b|$)`);
        expect(
            output.files.filter(({ path }) => path.endsWith('/gspot/link-text.yml')).map(({ path }) => path),
        ).toStrictEqual(['.gspot/config/vale/styles/gspot/link-text.yml']);
    },
);
