import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { dirname } from 'node:path/posix';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    PRODUCT_WORD_SETTINGS,
    RECOMMENDED_VALE_FILES,
} from '#tests/config/generation/configurations/general/prose.ts';
import {
    VALE_PACKAGES,
    BANNED_HEADINGS,
    VALE_MARKUP_FILES,
} from '#cli/config/generation/configurations/general/prose.ts';

test.each([...LEVELS])('Vale styles and packages follow the level (%s)', async (level) => {
    await using sandbox = await testdir({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level }),
    });

    runGitStep(sandbox.path, ['init', '-q']);
    const output = generate(await openSession(sandbox.path));
    const paths = new Set(output.files.map((file) => file.path));
    expect(paths.has(findFileTarget('prose', 'styles/gspot/link-text.yml'))).toBe(true);
    const configuration = output.files.find((file) => file.path === GSPOT_PATHS.valeConfigFile)!;
    expect(/^Packages = /mu.test(configuration.content)).toBe(level === 'all');
    expect(configuration.content).toContain(
        `BasedOnStyles = ${level === 'all' ? ['gspot', 'Vale', ...VALE_PACKAGES].join(', ') : 'gspot'}`,
    );
    const [general = '', markup = ''] = configuration.content.split(`[${VALE_MARKUP_FILES}]`);
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
            tables: '[docs]\nbanned_headings = ["Owner: [module]"]\n',
        }),
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const style = output.files.find((file) => file.path.endsWith('/gspot/banned-headings.yml'))!.content;
    expect((parse(style) as { tokens: string[] }).tokens).toStrictEqual([
        ...BANNED_HEADINGS.map((heading) => String.raw`(?:\b|^)${heading}(?:\b|$)`),
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
    // Each word appears once; SwiftLint stays out because no scope selects Swift.
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
