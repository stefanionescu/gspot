import { delimiter } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/harness/platforms.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { environmentVariables } from '#cli/platform/public.ts';

const TOOL_FAILURES_POLICY = buildPolicy(['files'], {
    tables: 'runner = "mise"\n',
    level: 'all',
});

test('the Taplo adapter reports both output streams and its exit code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TOOL_FAILURES_POLICY,
        'settings/layout.toml': 'a = 1\n',
    });
    const bin = await fakeTool(
        sandbox.path,
        'bin/taplo',
        `#!/usr/bin/env bun
if (process.argv.includes('--version')) {
    console.log('taplo 0.10.0');
    process.exit(0);
}
console.error('INFO taplo: loaded configuration');
console.log('ERROR taplo: cannot read the formatting configuration');
process.exit(2);
`,
    );
    commitAll(sandbox.path);
    const environment = {
        PATH: `${bin}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
    };
    const result = await runGspot(sandbox.path, ['check', '--only', 'files/taplo-format'], environment);
    expect(result.code, result.stderr + result.stdout).toBe(2);
    expect(result.stdout).toContain('taplo broke: exit 2');
    expect(result.stdout).toContain('INFO taplo: loaded configuration');
    expect(result.stdout).toContain('cannot read the formatting configuration');
});
