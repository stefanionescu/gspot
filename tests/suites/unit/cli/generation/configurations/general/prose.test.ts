import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { dirname } from 'node:path/posix';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';

import {
    PROSE_STYLE_CASES,
    PRODUCT_WORD_SETTINGS,
    RECOMMENDED_VALE_FILES,
} from '#tests/config/generation/configurations/general/prose.ts';

test.each([...LEVELS])('Vale styles and packages follow the level (%s)', async (level) => {
    await using sandbox = await createGitSandbox({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level }),
    });

    const output = generate(await openSession(sandbox.path));
    const paths = new Set(output.files.map((file) => file.path));
    expect(paths.has(findManifestTarget('prose', 'styles/gspot/link-text.yml'))).toBe(true);
    const configuration = output.files.find((file) => file.path === GSPOT_PATHS.valeConfigFile)!;
    expect(/^Packages = /mu.test(configuration.content)).toBe(level === 'all');
    expect(configuration.content).toContain(
        level === 'all'
            ? 'BasedOnStyles = gspot, Vale, Google, write-good, proselint, alex, Harper'
            : 'BasedOnStyles = gspot',
    );
    const [general = '', markup = ''] = configuration.content.split('[*.{md,mdx}]', 2);
    expect(general).toContain('gspot.alt-text = NO');
    expect(markup).toContain('gspot.alt-text = YES');
    expect(configuration.content.includes('Vocab = words')).toBe(level === 'all');
});

test('at level recommended, gspot writes only the Vale styles that run', async () => {
    await using sandbox = await testdir({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'recommended' }),
    });
    const output = generate(await openSession(sandbox.path));
    const paths = output.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${dirname(GSPOT_PATHS.valeConfigFile)}/`));
    expect(paths.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([...RECOMMENDED_VALE_FILES]);
});

test('your banned headings and the shipped ones reach the heading style once', async () => {
    await using sandbox = await testdir({
        'sample.md': '# Table of contents\n',
        'gspot.toml': buildSandboxSettings(['prose', 'docs'], {
            level: 'all',
            tables: '[docs]\nbanned_headings = ["Owner: [module]", "project layout"]\n',
        }),
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const style = output.files.find((file) => file.path.endsWith('/gspot/banned-headings.yml'))!.content;
    expect((parse(style) as { tokens: string[] }).tokens).toStrictEqual([
        String.raw`(?:\b|^)project structure(?:\b|$)`,
        String.raw`(?:\b|^)project layout(?:\b|$)`,
        String.raw`(?:\b|^)repository layout(?:\b|$)`,
        String.raw`(?:\b|^)repository structure(?:\b|$)`,
        String.raw`(?:\b|^)directory structure(?:\b|$)`,
        String.raw`(?:\b|^)folder structure(?:\b|$)`,
        String.raw`(?:\b|^)file map(?:\b|$)`,
        String.raw`(?:\b|^)codebase map(?:\b|$)`,
        String.raw`(?:\b|^)source tree(?:\b|$)`,
        String.raw`(?:\b|^)Owner: \[module\](?:\b|$)`,
    ]);
});

test('the Vale vocabulary and heading exceptions hold the products of every scope and your words, once each', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], PRODUCT_WORD_SETTINGS),
        'sample.md': '# Guide\n',
        'app/sample.py': 'value = 1\n',
    });

    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const text = files.find(({ path }) => path.endsWith('/vocabularies/words/accept.txt'))!.content;
    const vocabulary = text.split('\n');
    expect(vocabulary.at(-1)).toBe('');
    expect(
        ['Python', 'basedpyright', 'NebulaProduct', 'SwiftLint'].map(
            (word) => vocabulary.filter((line) => line === word).length,
        ),
    ).toStrictEqual([1, 1, 1, 0]);
    const heading = files.find(({ path }) => path.endsWith('/gspot/heading-case.yml'))!.content;
    const { exceptions } = parse(heading) as { exceptions: string[] };
    expect(
        ['Python', 'basedpyright', 'NebulaProduct', 'SwiftLint'].map(
            (word) => exceptions.filter((exception) => exception === word).length,
        ),
    ).toStrictEqual([1, 1, 1, 0]);
});

test('Vale disables E-Prime when the upstream styles are active', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
        'guide.md': '# Guide\n\nThe file is generated.\n',
    });
    const files = generate(await openSession(sandbox.path)).files;
    const ini = files.find(({ path }) => path === findManifestTarget('prose', 'vale.ini'))!.content;
    expect(ini).toContain('write-good.E-Prime = NO');
});

test.each(['recommended', 'all'] as const)('Vale limits code comments to mistake checks at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], { level }),
        'source.ts': "// The file is generated by ESLint's parser.\nexport const value = 1;\n",
    });
    const files = generate(await openSession(sandbox.path)).files;
    const ini = files.find(({ path }) => path === findManifestTarget('prose', 'vale.ini'))!.content;
    expect(ini).toContain(
        '[*.{ts,tsx,js,jsx,swift,py,css,sh,bash,zsh,sql,pgsql,psql}]\n' +
            'BasedOnStyles =\n' +
            'gspot.conscious-language = YES\n' +
            'gspot.placeholders = YES\n' +
            'gspot.merge-conflict-markers = YES\n' +
            'gspot.session-identifiers = YES\n' +
            'gspot.straight-quotes = YES\n' +
            'gspot.em-dashes = YES',
    );
    expect(ini).toContain(level === 'all' ? 'BasedOnStyles = gspot, Vale, Google' : 'BasedOnStyles = gspot');
});

test.each([...PROSE_STYLE_CASES])(
    'Vale keeps the configured $name rule and its message',
    async ({ name, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['prose'], {
                level: 'all',
                tables: '[prose]\nmax_list_item_words = 11\nmax_paragraph_sentences = 3\nmax_sentence_words = 17\n',
            }),
            'guide.md': '# Guide\n',
        });
        const files = generate(await openSession(sandbox.path)).files;
        const target = findManifestTarget('prose', `styles/gspot/${name}.yml`);
        const style: unknown = parse(files.find(({ path }) => path === target)!.content);
        expect(style).toMatchObject({ ...expected, level: 'error' });
        expect(style).not.toHaveProperty('setting');
    },
);
