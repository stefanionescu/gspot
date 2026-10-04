// Table settings accept TOML input. Unparsable values and quoted policy tables are rejected.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { CHECK, TABLE } from '#tests/config/cli/commands/typed-tables.ts';

test('gspot set writes a list of tables typed the TOML way as tables, and the policy refuses quoted ones', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'gspot.toml': buildPolicy(['docs', 'spelling'], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['set', 'docs.exclude', TABLE]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(policy).toContain('paths = ["REPORT.md"]');
    expect(policy).not.toContain('"[{paths');
    const unreadable = await runGspot(sandbox.path, ['set', 'docs.exclude', '[{paths = ']);
    expect(unreadable.code).toBe(2);
    expect(unreadable.stdout + unreadable.stderr).toContain('reads as neither JSON nor TOML');
    // A person can still type the quotes by hand, and the policy refuses that when it loads.
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        `${policy}\n[tools.typos]\nexclude = ['{paths = ["a"], reason = "x"}']\n`,
    );
    const read = await runGspot(sandbox.path, CHECK);
    expect(read.code, read.stdout + read.stderr).toBe(1);
    const { checks } = JSON.parse(read.stdout) as RunReport;
    expect(checks.find(({ check }) => check === 'gspot/policy')).toMatchObject({
        status: 'failed',
        findings: [
            {
                file: 'gspot.toml',
                message: expect.stringContaining('holds a table written inside quotes') as unknown,
            },
        ],
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = await runGspot(sandbox.path, CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
