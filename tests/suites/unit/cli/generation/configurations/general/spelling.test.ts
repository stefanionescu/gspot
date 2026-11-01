import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';

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
    const files = {
        'gspot.toml': buildSandboxSettings(['spelling'], settings),
    };
    await using sandbox = await testdir(files);

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const target = output.files.find((file) => file.path === getManifestTarget('spelling', 'typos.toml'))!;
    const parsed = parse(target.content) as Record<string, unknown>;
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
