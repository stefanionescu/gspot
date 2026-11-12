import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('typos.toml lists each allowed word once and keeps quoted paths', async () => {
    const words = ['café', "apostrophe'word", 'long-term'];
    const paths = ['docs/"draft"/**', 'generated/draft/**', 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    const settings = {
        rules: true,
        tables: stringify({
            spelling: { allowed_words: Object.fromEntries(words.map((word) => [word, reason])) },
            ignore: [{ check: 'spelling/typos', paths, reason }],
        }),
    };
    const parsed = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['spelling'], settings),
            getManifestTarget('spelling', 'typos.toml'),
            {},
        ),
    ) as Record<string, unknown>;
    expect((parsed['default'] as Record<string, unknown>)['extend-words']).toStrictEqual({
        café: 'café',
        "apostrophe'word": "apostrophe'word",
        'long-term': 'long-term',
    });
    const { 'extend-exclude': excluded, ...otherFiles } = parsed['files'] as { 'extend-exclude': string[] };
    expect(otherFiles).toStrictEqual({});
    expect(excluded.slice(-paths.length)).toStrictEqual(paths);
    expect(excluded).not.toContain('**');
});
