import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { actionlintSource } from '#cli/checks/tool/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { WORKFLOW_HEAD } from '#tests/config/samples/actions.ts';
import { PATH, PINACT_STUB } from '#tests/config/cli/checks/tool/actions.ts';

const TOOL_FAILURES_POLICY = buildPolicy(['files', 'actions'], {
    tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n',
    level: 'all',
});

test('the pin verification adapter reports a rejected commit and preserves the workflow', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TOOL_FAILURES_POLICY,
        'README.md': '# Action pins\n',
        'bin/pinact': PINACT_STUB,
        'bin/pinact.cmd': '@echo off\r\nbun "%~dp0pinact" %*\r\n',
    });
    await chmod(join(sandbox.path, 'bin/pinact'), 0o755);
    commitAll(sandbox.path);
    const environment = {
        PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
    };
    const path = join(sandbox.path, '.github/workflows/broken.yml');
    const workflow = `${WORKFLOW_HEAD}            - uses: actions/checkout@0000000000000000000000000000000000000000\n`;
    await Bun.write(path, workflow);
    const result = await runGspot(sandbox.path, ['check', '--only', 'actions/pinact'], environment);
    expect(result.code, result.stderr + result.stdout).toBe(1);
    expect(result.stdout).toContain('invalid action pin: broken.yml');
    expect(await Bun.file(path).text()).toBe(workflow);
    await Bun.write(path, workflow.replace('0'.repeat(40), 'a'.repeat(40)));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'actions/pinact', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'actions/pinact', status: 'passed', findings: [] },
    ]);
});

// The workflow text actionlint reads: each self-repository marker of a reference becomes a local path at the same
// offsets, and everything else stays as written.

test.each([
    [`$/${PATH}`, `./${PATH}`],
    [`"$/${PATH}"`, `"./${PATH}"`],
    [`'$/${PATH}'`, `'./${PATH}'`],
    [String.raw`"\x24/` + `${PATH}"`, String.raw`"\x2e/` + `${PATH}"`],
    [String.raw`"\u0024/` + `${PATH}"`, String.raw`"\u002e/` + `${PATH}"`],
    [String.raw`"\U00000024/` + `${PATH}"`, String.raw`"\U0000002e/` + `${PATH}"`],
    [`|-\n          $/${PATH}`, `|-\n          ./${PATH}`],
    [`|- # $comment\n          $/${PATH}`, `|- # $comment\n          ./${PATH}`],
    ['$/.github/workflows/$called.yml', './.github/workflows/$called.yml'],
    ['actions/checkout@v4', 'actions/checkout@v4'],
])('the reference %s reaches actionlint as %s', (reference, expected) => {
    const before = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`;
    const prepared = actionlintSource(before);
    expect(prepared).toBe(`on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`);
    expect(prepared).toHaveLength(before.length);
});

test('an alias resolves to the anchored reference, which changes where it is written', () => {
    const workflow = `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${PATH}\njobs:\n  caller:\n    uses: *workflow\n`;
    expect(actionlintSource(workflow)).toBe(workflow.replace(`$/${PATH}`, `./${PATH}`));
});

test('text that is not a YAML mapping stays as written', () => {
    expect(actionlintSource('uses: [$/unclosed\n')).toBe('uses: [$/unclosed\n');
});
