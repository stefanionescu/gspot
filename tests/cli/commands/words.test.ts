import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { PROSE_WORDS } from '#tests/config/samples/prose.ts';
import { EXCEPTION_REASON } from '#tests/config/cli/commands/setting-reasons.ts';

test('accepted words reach the generated Vale word file', async () => {
    await using sandbox = await testdir();
    const [first, second] = PROSE_WORDS;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[words]\n${second} = ${JSON.stringify(EXCEPTION_REASON)}\n[agent_rules]\nenabled = false\n`,
        }),
        'guide.md': '# Guide\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const accepted = await Bun.file(
        join(sandbox.path, '.gspot/config/vale/styles/config/vocabularies/words/accept.txt'),
    ).text();
    const words = accepted.trimEnd().split('\n');
    expect(words).toContain(second);
    expect(words).toContain('TypeScript');
    expect(words).not.toContain(first);
    expect(words.filter((word) => word === second)).toHaveLength(1);
});
