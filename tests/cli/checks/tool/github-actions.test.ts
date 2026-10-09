import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { stat, chmod } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { checkRun } from '#cli/execution/contracts.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { actionlintSource } from '#cli/checks/tool/public.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { WORKFLOW_HEAD } from '#tests/config/samples/actions.ts';
import { PATH, PINACT_STUB } from '#tests/config/cli/checks/tool/github-actions.ts';

const TOOL_FAILURES_POLICY = buildPolicy(['files', 'github-actions'], {
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
    const result = await runGspot(sandbox.path, ['check', '--only', 'github-actions/pinact'], environment);
    expect(result.code, result.stderr + result.stdout).toBe(1);
    expect(result.stdout).toContain('invalid action pin: broken.yml');
    expect(await Bun.file(path).text()).toBe(workflow);
    await Bun.write(path, workflow.replace('0'.repeat(40), 'a'.repeat(40)));
    const corrected = await checkReport(
        sandbox.path,
        ['check', '--only', 'github-actions/pinact', '--json'],
        environment,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'github-actions/pinact', status: 'passed', findings: [] }]);
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

test.each([
    { code: 0, status: 'passed', findings: [], note: undefined },
    {
        code: 1,
        status: 'failed',
        findings: [{ file: '.github/workflows/caller.yml', rule: 'workflow-call' }],
        note: undefined,
    },
    { code: 3, status: 'error', findings: [], note: 'exit 3' },
])(
    'Actionlint removes its prepared project after adapter exit $code without changing source permissions',
    async ({ code, status, findings, note }) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['github-actions']),
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        });
        await chmod(executable, 0o755);
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'commit', skips: [], only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await checkRun(planned.check, BUILT_IN_CHECKS)(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(status);
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(await pathExists(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        const attributes = await stat(join(sandbox.path, '.github/workflows/caller.yml'));
        expect(attributes.mode & 0o777).toBe(getKeptMode(0o444));
        expect(await pathExists(join(sandbox.path, '.git'))).toBe(false);
        if (note !== undefined) expect(result.note).toContain(note);
        expect(result.findings).toMatchObject(findings);
    },
);
