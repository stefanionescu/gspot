import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { applyFixers } from '#cli/execution/fixers.ts';
import { openSession } from '#cli/commands/session.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { planFixer, buildFixerPolicy } from '#tests/harness/fixer.ts';

test('fixer environment paths expand against the scratch execution root during preview', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildFixerPolicy(),
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });
    const trace = join(sandbox.path, 'execution-root');
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        `await Bun.write('café settings.txt', 'scratch corrected'); await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text()); await Bun.write(${JSON.stringify(trace)}, process.cwd())`,
    );
    planned.check.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await applyFixers(session, [planned], { checks: BUILT_IN_CHECKS, isDryRun: true });
    expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
    expect(result.diffs).toStrictEqual([textContaining('+scratch corrected')]);
    const executionRoot = await readFile(trace, 'utf8');
    expect(executionRoot).not.toBe(sandbox.path);
    expect(await pathExists(executionRoot)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(await readFile(join(sandbox.path, 'café settings.txt'), 'utf8')).toBe('corrected');
});
