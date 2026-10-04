// Check engines split tool output on LF, so the runner hands them LF wherever the tool ran.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { runEngineTool, runCommandCheck } from '#cli/execution/command/runner.ts';
import { HEADER_FAILURE } from '#tests/config/cli/execution/tool-runner/output.ts';

test('a check command hands its engine LF line endings when the tool prints CRLF', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['bash']) });
    const session = await openSession(sandbox.path);
    const input = buildEngineInput(session, 'bash/syntax');
    const printed = String.raw`process.stdout.write('one\r\ntwo\r\n'); process.stderr.write('three\r\n');`;
    const result = await runEngineTool(input, [process.execPath, '-e', printed], { cwd: sandbox.path });
    expect(result.stdout).toBe('one\ntwo\n');
    expect(result.stderr).toBe('three\n');
});

test('per-file failures omit only headers the selected tool declares', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[[check]]\nname = "project/native"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', HEADER_FAILURE, '{file}'])}\n`,
        }),
        'source.txt': 'source\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['project/native'] })[0]!;
    const unfiltered = await runCommandCheck(session, planned);
    expect(unfiltered.status).toBe('failed');
    expect(unfiltered.findings).toMatchObject([{ file: 'source.txt', message: 'Banner: scanner 1' }]);
    const filtered = await runCommandCheck(session, {
        ...planned,
        tool: { ...planned.tool!, diagnostic_header_pattern: '^Banner:' },
    });
    expect(filtered.status).toBe('failed');
    expect(filtered.findings).toMatchObject([{ file: 'source.txt', message: 'Native input failed.' }]);
});
