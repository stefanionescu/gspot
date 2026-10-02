// Table settings accept TOML input. Unparsable values and quoted policy tables are rejected.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

const REASON = 'The report names the folders the move deleted, which is what it is for.';
const TABLE = `[{patterns = ["REPORT.md"], reason = "${REASON}"}]`;
const CHECK = ['check', '--only', 'docs/readme-present', '--json'];

test('gspot set writes a list of tables typed the TOML way as tables, and the policy refuses quoted ones', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# planted\n',
        'gspot.toml': policyOf(['docs', 'spelling'], '[guides]\ninstall = false\n'),
    });
    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['set', 'tools.docs.paths_allowed', TABLE]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(policy).toContain('patterns = ["REPORT.md"]');
    expect(policy).not.toContain('"[{patterns');
    const unreadable = await runGspot(sandbox.path, ['set', 'tools.docs.paths_allowed', '[{patterns = ']);
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
    expect(checks.find(({ check }) => check === 'integrity/policy')).toMatchObject({
        status: 'fail',
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
