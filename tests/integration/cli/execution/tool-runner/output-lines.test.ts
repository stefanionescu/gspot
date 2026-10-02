// Check engines split tool output on LF, so the runner hands them LF wherever the tool ran.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';

test('a check command hands its engine LF line endings when the tool prints CRLF', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf(['bash']) });
    const session = await openSession(sandbox.path);
    const input = scopeInput(session, session.manifests.get('bash')!.checks[0]!);
    const printed = String.raw`process.stdout.write('one\r\ntwo\r\n'); process.stderr.write('three\r\n');`;
    const result = await runCheckCommand(input, [process.execPath, '-e', printed], { cwd: sandbox.path });
    expect(result.stdout).toBe('one\ntwo\n');
    expect(result.stderr).toBe('three\n');
});
