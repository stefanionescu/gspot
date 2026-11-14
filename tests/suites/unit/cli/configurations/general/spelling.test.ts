import { test, expect } from 'bun:test';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

test('typos.toml writes allowed words and ignored paths as TOML strings that add no table', async () => {
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

test('typos.toml excludes *.lock once and no named lockfile', async () => {
    const parsed = parse(
        await buildGeneratedFile(buildSandboxSettings(['spelling']), getManifestTarget('spelling', 'typos.toml'), {}),
    ) as { files: { 'extend-exclude': string[] } };
    const lockPatterns = parsed.files['extend-exclude'].filter((pattern) => pattern.endsWith('.lock'));
    expect(lockPatterns).toStrictEqual(['**/*.lock']);
});
