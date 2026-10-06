import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { PROSE_WORDS, EXCEPTION_REASON } from '#tests/config/cli/commands/setting-reasons.ts';

test('reasoned vocabulary survives list edits and reaches generated Vale words', async () => {
    await using sandbox = await testdir();
    const [first, second] = PROSE_WORDS;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'require_reasons = true\n[agent_rules]\nenabled = false\n' }),
        'guide.md': '# Guide\n',
    });
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['set', 'prose.vocabulary', first]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('prose.vocabulary needs a reason');
    expect(readTree(sandbox.path)).toStrictEqual(before);
    for (const argv of [
        ['set', 'prose.vocabulary', first, '--reason', EXCEPTION_REASON],
        ['set', 'prose.vocabulary', second, '--reason', EXCEPTION_REASON],
        ['set', 'prose.vocabulary', first, '--remove'],
    ]) {
        const changed = await runGspot(sandbox.path, argv);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    }
    const saved = parseToml(await Bun.file(join(sandbox.path, 'gspot.toml')).text());
    expect(saved['prose']).toStrictEqual({ vocabulary: { value: [second], reason: EXCEPTION_REASON } });
    const accepted = await Bun.file(
        join(sandbox.path, '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt'),
    ).text();
    const words = accepted.trimEnd().split('\n');
    expect(words).toContain(second);
    expect(words).toContain('TypeScript');
    expect(words).not.toContain(first);
    expect(words.filter((word) => word === second)).toHaveLength(1);
});
