import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { dirname, relative } from 'node:path/posix';
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
            const targetPath = `.gspot/config/${scope}/vale-scoped.ini`;
            const configuration = output.files.find(({ path }) => path === targetPath)!.content;
            expect(configuration).toContain(
                level === 'all'
                    ? `StylesPath = ${relative(dirname(targetPath), '.gspot/vale')}\nStylesPath = .gspot/config/${scope}/vale/styles\nStylesPath = .gspot/config/vale/styles\n`
                    : 'StylesPath = vale/styles\nStylesPath = .gspot/config/vale/styles\n',
            );
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

test.each(['recommended', 'all'] as const)(
    '%s declares portable native replacement styles in every scope',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['prose'], { level, tables: '[scope.child]\nconfigurations = ["prose"]\n' }),
            'sample.md': '# Guide\n',
            'child/sample.md': '# Guide\n',
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const styles = session.manifests
            .get('prose')!
            .toolFiles.filter(
                (file) => file.source?.startsWith('styles/gspot/') === true && file.target.endsWith('.yml'),
            );
        for (const file of styles) {
            expect(output.files.some(({ path }) => path === file.target)).toBe(true);
            const name = file.target.slice(file.target.lastIndexOf('/') + 1, -4);
            if (['dates', 'link-text', 'alt-text', 'us-english', 'merge-conflict-markers'].includes(name)) continue;
            for (const configuration of output.files.filter(({ path }) => path.endsWith('vale-scoped.ini'))) {
                expect(configuration.content.includes(`gspot.${name} = NO`), `${configuration.path}: ${name}`).toBe(
                    level === 'recommended',
                );
            }
        }
        const action = output.files.find(({ path }) => path.endsWith('/no-gerunds-in-titles.tengo'))!;
        expect(action.content).toContain('"running": "run"');
        expect(output.files.find(({ path }) => path.endsWith('/gerund-headings.yml'))!.content).toContain(
            'no-gerunds-in-titles.tengo',
        );
        expect(output.files.some(({ path }) => path.includes('/gspot/actions/'))).toBe(false);
    },
);
