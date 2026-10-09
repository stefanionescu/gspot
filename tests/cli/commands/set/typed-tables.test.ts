// Table settings accept TOML input. Unparsable values and quoted policy tables are rejected.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { CHECK, TABLE } from '#tests/config/cli/commands/set/typed-tables.ts';

test('gspot set writes a list of tables typed the TOML way as tables, and the policy refuses quoted ones', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'gspot.toml': buildPolicy(['docs', 'javascript'], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', TABLE]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(policy).toContain('name = "unreviewed-module"');
    expect(policy).not.toContain('"[{name');
    const unreadable = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', '[{name = ']);
    expect(unreadable.code).toBe(2);
    expect(unreadable.stdout + unreadable.stderr).toContain('reads as neither JSON nor TOML');
    // A person can still type the quotes by hand, and the policy refuses that when it loads.
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['docs', 'javascript'], {
            tables: `[agent_rules]\nenabled = false\n[tools.eslint]\nrestricted_imports = ['{name = "a", message = "Use its public entrypoint."}']\n`,
        }),
    );
    const read = await runGspot(sandbox.path, CHECK);
    expect(read.code, read.stdout + read.stderr).toBe(2);
    expect(JSON.parse(read.stdout) as CommandFailureJson).toStrictEqual({
        error: 'policy',
        message: 'gspot.toml: tools.eslint.restricted_imports.0: Invalid input: expected object, received string',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = await runGspot(sandbox.path, CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
