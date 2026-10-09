import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { savePolicy } from '#cli/commands/contracts.ts';
import { setKey, preparePolicy } from '#cli/policy/document/contracts.ts';

test('a policy command evaluates its mutation once before applying the prepared result', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    let evaluations = 0;
    const input = preparePolicy(sandbox.path);
    const result = await savePolicy(sandbox.path, {
        input,
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

test('a policy command refuses changes after capture without rereading them as its input', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    const input = preparePolicy(sandbox.path);
    const concurrent = `${input.text}# Another writer owns this change.\n`;
    await writeFile(path, concurrent);
    const failure = await savePolicy(sandbox.path, {
        input,
        change: (raw) => {
            setKey(raw, 'test_files', ['qa/**']);
        },
        summary: 'Updated test_files.',
        isDryRun: false,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({
        message: 'Lifecycle destination changed during the operation: gspot.toml',
    });
    expect(await readFile(path, 'utf8')).toBe(concurrent);
});
