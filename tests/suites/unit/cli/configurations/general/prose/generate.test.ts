import { expect, test } from 'bun:test';
import { parse } from 'yaml';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('your banned headings and the shipped ones reach the heading style once', async () => {
    const style = await buildGeneratedFile(
        buildSandboxSettings(['prose', 'docs'], {
            level: 'all',
            tables: '[prose]\nbanned_headings = ["Owner: [module]", "project layout"]\n',
        }),
        getManifestTarget('prose', 'styles/gspot/banned-headings.yml'),
        { 'sample.md': '# Table of contents\n' },
    );
    const { tokens } = parse(style) as { tokens: string[] };
    expect(tokens).toContain(String.raw`(?:\b|^)project structure(?:\b|$)`);
    expect(tokens).toContain(String.raw`(?:\b|^)Owner: \[module\](?:\b|$)`);
    expect(tokens.filter((token) => token === String.raw`(?:\b|^)project layout(?:\b|$)`)).toHaveLength(1);
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
    expect(parse(style)).toMatchObject({ swap: { 'config file': 'generated file', program: 'tool' } });
    const valeIni = files.find(({ path }) => path === getManifestTarget('prose', 'vale.ini'))!.content;
    const commentSection = valeIni.split('\n\n').find((section) => section.startsWith('[*.{'))!;
    expect(commentSection.split('\n')).toContain('gspot.terms = YES');
});

test('Vale keeps the configured sentence-length rule and its message', async () => {
    const style: unknown = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['prose'], { level: 'all', tables: '[prose]\nmax_sentence_words = 17\n' }),
            getManifestTarget('prose', 'styles/gspot/sentence-length.yml'),
            { 'guide.md': '# Guide\n' },
        ),
    );
    expect(style).toMatchObject({ max: 17, message: 'A sentence longer than 17 words. Split it.' });
    expect(style).not.toHaveProperty('setting');
});
