import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { VALE_PACKAGES, VALE_MARKUP_FILES } from '#cli/config/generation/settings/builders/vale.ts';
import { PRODUCT_WORD_SETTINGS, RECOMMENDED_VALE_FILES } from '#tests/data/generation/settings/builders/vale.ts';

test.each([...LEVELS])('Vale styles and packages follow the level (%s)', async (level) => {
    await using sandbox = await testdir({
        'sample.md': '# Sample\n',
        'gspot.toml': buildSandboxSettings(['prose'], { level }),
    });

    runGitStep(sandbox.path, ['init', '-q']);
    const output = generate(await openSession(sandbox.path));
    const paths = new Set(output.files.map((file) => file.path));
    expect(paths.has('.gspot/configurations/general/prose/styles/gspot/link-text.yml')).toBe(true);
    const configuration = output.files.find((file) => file.path === '.gspot/configurations/general/prose/vale.ini')!;
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
        .filter((path) => path.startsWith('.gspot/configurations/general/prose/'));
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
    expect(parse(style)).toMatchObject({
        tokens: matchItems([String.raw`(?:\b|^)Owner: \[module\](?:\b|$)`, String.raw`(?:\b|^)source tree(?:\b|$)`]),
    });
    expect(style.toLowerCase()).not.toContain('table of contents');
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
    expect(text.endsWith('\n')).toBe(true);
    const vocabulary = text.trimEnd().split('\n');
    expect(vocabulary).toContain('Python');
    expect(vocabulary).toContain('basedpyright');
    expect(vocabulary).toContain('NebulaProduct');
    expect(vocabulary).not.toContain('SwiftLint');
    expect(vocabulary.filter((word) => word === 'Python')).toHaveLength(1);
    const heading = files.find(({ path }) => path.endsWith('/gspot/heading-case.yml'))!.content;
    expect(parse(heading)).toMatchObject({
        exceptions: matchItems(['NebulaProduct', 'Python', 'basedpyright']),
    });
});
