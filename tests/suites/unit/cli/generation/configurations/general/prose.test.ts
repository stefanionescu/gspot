import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { dirname } from 'node:path/posix';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/planning/session.ts';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    GSPOT_STYLES_LINE,
    PROSE_STYLE_CASES,
    PRODUCT_WORD_SETTINGS,
    DEFAULT_LEVEL_STYLE_FILES,
} from '#tests/config/generation/configurations/general.ts';

test.each([...LEVELS])('Vale styles and packages follow the level (%s)', async (level) => {
    await using sandbox = await createGitSandbox({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level }),
    });

    const output = buildGeneratedFiles(await openSession(sandbox.path));
    const paths = new Set(output.files.map((file) => file.path));
    expect(paths.has(getManifestTarget('prose', 'styles/gspot/link-text.yml'))).toBe(true);
    const configuration = output.files.find((file) => file.path === GSPOT_PATHS.valeConfig)!;
    expect(/^Packages = /mu.test(configuration.content)).toBe(level === 'all');
    const styles = configuration.content.split('\n').find((line) => line.startsWith(GSPOT_STYLES_LINE));
    if (level === 'all') expect(styles).toStartWith(`${GSPOT_STYLES_LINE}, Vale, `);
    else expect(styles).toBe(GSPOT_STYLES_LINE);
    const [general = '', markup = ''] = configuration.content.split('[*.{md,mdx}]', 2);
    expect(general).toContain('gspot.alt-text = NO');
    expect(markup).toContain('gspot.alt-text = YES');
    expect(configuration.content.includes('Vocab = words')).toBe(level === 'all');
});

test('at level basic, gspot writes only the Vale styles that run', async () => {
    await using sandbox = await testdir({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'basic' }),
    });
    const output = buildGeneratedFiles(await openSession(sandbox.path));
    const paths = output.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${dirname(GSPOT_PATHS.valeConfig)}/`));
    expect(paths.toSorted(compareText)).toStrictEqual([
        ...DEFAULT_LEVEL_STYLE_FILES.map((file) => getManifestTarget('prose', file)),
        GSPOT_PATHS.valeConfig,
    ]);
});

test('your banned headings and the shipped ones reach the heading style once', async () => {
    await using sandbox = await testdir({
        'sample.md': '# Table of contents\n',
        'gspot.toml': buildSandboxSettings(['prose', 'docs'], {
            level: 'all',
            tables: '[prose]\nbanned_headings = ["Owner: [module]", "project layout"]\n',
        }),
    });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const style = output.files.find((file) => file.path.endsWith('/gspot/banned-headings.yml'))!.content;
    const { tokens } = parse(style) as { tokens: string[] };
    expect(tokens).toContain(String.raw`(?:\b|^)project structure(?:\b|$)`);
    expect(tokens).toContain(String.raw`(?:\b|^)Owner: \[module\](?:\b|$)`);
    expect(tokens.filter((token) => token === String.raw`(?:\b|^)project layout(?:\b|$)`)).toHaveLength(1);
});

test('the Vale vocabulary and heading exceptions hold the products of every scope and your words, once each', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose'], PRODUCT_WORD_SETTINGS),
        'sample.md': '# Guide\n',
        'app/sample.py': 'value = 1\n',
    });

    const session = await openSession(sandbox.path);
    const files = buildGeneratedFiles(session).files;
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
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const ini = files.find(({ path }) => path === getManifestTarget('prose', 'vale.ini'))!.content;
    expect(ini).toContain('write-good.E-Prime = NO');
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
        const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
        const target = getManifestTarget('prose', `styles/gspot/${name}.yml`);
        const style: unknown = parse(files.find(({ path }) => path === target)!.content);
        expect(style).toMatchObject({ ...expected, level: 'error' });
        expect(style).not.toHaveProperty('setting');
    },
);
