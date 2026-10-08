// Built-in checks split tool output on LF, so check execution hands them LF wherever the tool ran.
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { runCheckTool, runCheckCommand } from '#cli/execution/command/public.ts';
import { HEADER_FAILURE } from '#tests/config/cli/execution/tool-runner/output.ts';

test('a check command hands its built-in check LF line endings when the tool prints CRLF', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['bash']) });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'bash/bash-syntax');
    const printed = String.raw`process.stdout.write('one\r\ntwo\r\n'); process.stderr.write('three\r\n');`;
    const result = await runCheckTool(input, [process.execPath, '-e', printed], { cwd: sandbox.path });
    expect(result.stdout).toBe('one\ntwo\n');
    expect(result.stderr).toBe('three\n');
});

test('per-file failures omit only headers the selected tool declares', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[check."project/native"]\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', HEADER_FAILURE, '{file}'])}\n`,
        }),
        'source.txt': 'source\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['project/native'] })[0]!;
    const unfiltered = await runCheckCommand(session, planned);
    expect(unfiltered.status).toBe('failed');
    expect(unfiltered.findings).toMatchObject([{ file: 'source.txt', message: 'Banner: scanner 1' }]);
    const filtered = await runCheckCommand(session, {
        ...planned,
        tool: { ...planned.tool!, diagnostic_header_pattern: '^Banner:' },
    });
    expect(filtered.status).toBe('failed');
    expect(filtered.findings).toMatchObject([{ file: 'source.txt', message: 'Native input failed.' }]);
});
