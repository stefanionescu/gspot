import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { VALE_PACKAGES } from '#cli/config/tools/vale.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';

test('the Vale vocabulary joins selected product words and your words once each', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Sample\n',
        'gspot.toml': buildSettingsText(['prose', 'javascript'], {
            level: 'all',
            tables: '[allowed_words]\nvalue = ["NebulaConfiguration", "TypeScript"]\nreason = "The repository uses the reviewed product names."\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const vocabulary = output.files.find(
        (file) => file.path === '.gspot/config/vale/styles/config/vocabularies/words/accept.txt',
    )!;
    const words = vocabulary.content.trimEnd().split('\n');
    expect(words).toContain('TypeScript');
    expect(words).toContain('JavaScript');
    expect(words).toContain('ESLint');
    for (const word of ['Swift', 'Ruff', 'Xcode']) expect(words).not.toContain(word);
    expect(words).toContain('NebulaConfiguration');
    expect(words.filter((word) => word === 'NebulaConfiguration')).toHaveLength(1);
    expect(words.filter((word) => word === 'TypeScript')).toHaveLength(1);
    expect(vocabulary.content.endsWith('\n')).toBe(true);
});

test.each([...LEVELS])('Vale styles and packages follow the level (%s)', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Sample\n',
        'gspot.toml': buildSettingsText(['prose'], { level }),
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    const output = generate(await openSession(sandbox.path));
    const paths = new Set(output.files.map((file) => file.path));
    expect(paths.has('.gspot/config/vale/styles/gspot/link-text.yml')).toBe(true);
    const configuration = output.files.find((file) => file.path === '.gspot/config/vale.ini')!;
    expect(configuration.content.includes(`Packages = ${VALE_PACKAGES.join(', ')}`)).toBe(level === 'all');
    expect(configuration.content).toContain(
        `BasedOnStyles = ${level === 'all' ? ['gspot', 'Vale', ...VALE_PACKAGES].join(', ') : 'gspot'}`,
    );
});

test('your banned headings and the shipped ones reach the heading style once', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Table of contents\n',
        'gspot.toml': buildSettingsText(['prose', 'docs'], {
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

test('the Vale vocabulary and heading exceptions include products of child scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['prose'], {
            level: 'all',
            tables: '[allowed_words]\nvalue = ["NebulaProduct"]\nreason = "The project uses this reviewed product name."\n[[scope]]\npath = "app"\n\nconfigurations = ["python"]\n[[scope]]\npath = "sibling"\n\nconfigurations = []\n',
        }),
        'sample.md': '# Guide\n',
        'app/sample.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const vocabulary = files
        .find(({ path }) => path.endsWith('/vocabularies/words/accept.txt'))!
        .content.trimEnd()
        .split('\n');
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
