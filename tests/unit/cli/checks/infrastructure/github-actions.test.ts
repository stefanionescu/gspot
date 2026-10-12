import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/errors.ts';
import { stat, chmod } from 'node:fs/promises';
import { planRun } from '#cli/planning/checks.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { processResult } from '#tests/setup/processes.ts';
import { fileMode } from '#cli/system/safe-folder/reads.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { checkedFindings } from '#cli/execution/command/output.ts';
import { actionlintSource } from '#cli/checks/infrastructure/github-actions.ts';
import { CALLED_WORKFLOW, ACTIONLINT_EXITS, CALLED_WORKFLOW_REFERENCES } from '#tests/config/github-actions.ts';

// The workflow text actionlint reads: each self-repository marker of a reference becomes a local path at the same
// offsets, and everything else stays as written.

test.each(CALLED_WORKFLOW_REFERENCES)('the reference %s reaches actionlint as %s', (reference, expected) => {
    const before = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`;
    const prepared = actionlintSource(before);
    expect(prepared).toBe(`on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`);
    expect(prepared).toHaveLength(before.length);
});

test('an alias resolves to the anchored reference, which changes where it is written', () => {
    const workflow = `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`;
    expect(actionlintSource(workflow)).toBe(workflow.replace(`$/${CALLED_WORKFLOW}`, `./${CALLED_WORKFLOW}`));
});

test('text that is not a YAML mapping stays as written', () => {
    expect(actionlintSource('uses: [$/unclosed\n')).toBe('uses: [$/unclosed\n');
});

test.each([...ACTIONLINT_EXITS])(
    'actionlint runs in a scratch copy that is removed after exit $code, and the workflow is unchanged',
    async ({ code, status, findings, note }) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['github-actions']),
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        });
        await chmod(executable, 0o755);
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        using _pins = mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'shellcheck')]);
        const plans = planRun(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await BUILT_IN_CHECKS['github-actions/actionlint'].run(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(status);
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(await pathExists(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        const attributes = await stat(join(sandbox.path, '.github/workflows/caller.yml'));
        expect(attributes.mode & 0o777).toBe(fileMode({ mode: 0o444 }));
        expect(await pathExists(join(sandbox.path, '.git'))).toBe(false);
        if (note !== undefined) expect(result.note).toContain(note);
        expect(result.findings).toMatchObject(findings);
    },
);

test('pinact reports a rate limit as an error and a finished read as findings', async () => {
    const failure = '429 Too Many Requests';
    await using sandbox = await testdir();
    const workflow = 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['github-actions']),
        '.github/workflows/check.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'push', only: ['github-actions/pinact'] });
    const planned = plans[0]!;
    const result = processResult({
        code: 1,
        stderr: `ERROR failed to handle a line: GET https://api.github.com/repos/actions/checkout/commits/v4: ${failure}`,
    });
    expect(() => checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toThrow(GspotError);
    expect(
        checkedFindings(
            planned,
            { ...result, stderr: 'invalid action pin: .github/workflows/check.yml:4' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual([
        containing({
            check: 'github-actions/pinact',
            message: 'invalid action pin: .github/workflows/check.yml:4',
        }),
    ]);
    expect(
        checkedFindings(planned, { ...result, code: 0, stderr: '' }, { cwd: sandbox.path, root: sandbox.path }),
    ).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
});
