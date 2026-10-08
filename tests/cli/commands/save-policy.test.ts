import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { setKey } from '#cli/policy/edit.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { savePolicy } from '#cli/commands/save-policy.ts';

test('a policy command evaluates its mutation once before applying the prepared result', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    let evaluations = 0;
    const result = await savePolicy(sandbox.path, {
        change: (raw) => {
            evaluations += 1;
            setKey(raw, 'test_files', evaluations === 1 ? ['qa/**'] : ['other/**']);
        },
        summary: 'Updated test_files.',
        isDryRun: false,
    });
    expect(result.exitCode).toBe(0);
    expect(evaluations).toBe(1);
    expect(await readFile(path, 'utf8')).toContain('test_files = ["qa/**"]');
});
