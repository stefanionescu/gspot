import { expect, test } from 'bun:test';
import { parse } from 'yaml';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('your banned headings and the shipped ones reach the heading style once', async () => {
    await using sandbox = await createGitSandbox({
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

test('the heading-case exceptions hold a product name of several words', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose', 'github-actions'], { level: 'all' }),
        'guide.md': '# Guide\n',
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const target = getManifestTarget('prose', 'styles/gspot/heading-case.yml');
    const { exceptions } = parse(files.find(({ path }) => path === target)!.content) as { exceptions: string[] };
    expect(exceptions).toContain('GitHub Actions');
});

test('the naming terms reach the terms style, and Vale runs that style on code comments', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose', 'naming'], {
            level: 'all',
            tables: '[naming]\nterms = { "config file" = "generated file", program = "tool" }\n',
        }),
        'guide.md': '# Guide\n',
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const style = files.find(({ path }) => path === getManifestTarget('prose', 'styles/gspot/terms.yml'))!.content;
    expect(parse(style)).toMatchObject({
        extends: 'substitution',
        level: 'error',
        swap: { 'config file': 'generated file', program: 'tool' },
    });
    const valeIni = files.find(({ path }) => path === getManifestTarget('prose', 'vale.ini'))!.content;
    const commentSection = valeIni.split('\n\n').find((section) => section.startsWith('[*.{'))!;
    expect(commentSection.split('\n')).toContain('gspot.terms = YES');
});

test('Vale keeps the configured sentence-length rule and its message', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], {
            level: 'all',
            tables: '[prose]\nmax_sentence_words = 17\n',
        }),
        'guide.md': '# Guide\n',
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const target = getManifestTarget('prose', 'styles/gspot/sentence-length.yml');
    const style: unknown = parse(files.find(({ path }) => path === target)!.content);
    expect(style).toMatchObject({
        scope: 'sentence',
        max: 17,
        message: 'A sentence longer than 17 words. Split it.',
        level: 'error',
    });
    expect(style).not.toHaveProperty('setting');
});
