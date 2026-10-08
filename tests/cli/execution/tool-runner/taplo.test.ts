import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const TOOL_FAILURES_POLICY = buildPolicy(['files'], {
    tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n',
    level: 'all',
});

test('the Taplo adapter reports both output streams and its exit code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TOOL_FAILURES_POLICY,
        'settings/layout.toml': 'a = 1\n',
        'bin/taplo': `#!/usr/bin/env bun
if (process.argv.includes('--version')) {
    console.log('taplo 0.10.0');
    process.exit(0);
}
console.error('INFO taplo: loaded configuration');
console.log('ERROR taplo: cannot read the formatting configuration');
process.exit(2);
`,
        'bin/taplo.cmd': '@echo off\r\nbun "%~dp0taplo" %*\r\n',
    });
    await chmod(join(sandbox.path, 'bin/taplo'), 0o755);
    commitAll(sandbox.path);
    const environment = {
        PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
    };
    const result = await runGspot(sandbox.path, ['check', '--only', 'files/taplo-format'], environment);
    expect(result.code, result.stderr + result.stdout).toBe(2);
    expect(result.stdout).toContain('taplo broke: exit 2');
    expect(result.stdout).toContain('INFO taplo: loaded configuration');
    expect(result.stdout).toContain('cannot read the formatting configuration');
    await Bun.write(
        join(sandbox.path, 'bin/taplo'),
        '#!/usr/bin/env bun\nif (process.argv.includes("--version")) console.log("taplo 0.10.0");\n',
    );
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'files/taplo-format', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/taplo-format', status: 'passed', findings: [] },
    ]);
});
