import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { PROSE_STYLE_CASES } from '#tests/config/configurations/general.ts';

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

test.each([...PROSE_STYLE_CASES])(
    'Vale keeps the configured $name rule and its message',
    async ({ name, expected }) => {
        await using sandbox = await createGitSandbox({
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
