import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { processResult } from '#tests/setup/processes.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { CALLED_WORKFLOW, ACTIONLINT_EXITS, CALLED_WORKFLOW_REFERENCES } from '#tests/config/github-actions.ts';

// The workflow text actionlint reads: each self-repository marker of a reference becomes a local path at the same
// offsets, and everything else stays as written.

test.each([
    ...CALLED_WORKFLOW_REFERENCES.map(([reference, expected]) => [
        `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`,
        `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`,
    ]),
    [
        `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
        `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow ./${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
    ],
    ['uses: [$/unclosed\n', 'uses: [$/unclosed\n'],
])('actionlint reads references without changing their offsets: %s', async (before, expected) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['github-actions']),
        '.github/workflows/caller.yml': before,
    });
    const session = await openSession(sandbox.path);
    using _pins = mockPinnedExecutables([
        toolDeclaration(session.manifests.values(), 'actionlint'),
        toolDeclaration(session.manifests.values(), 'shellcheck'),
    ]);
    using run = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
        const prepared = await readFile(join(options.cwd, '.github/workflows/caller.yml'), 'utf8');
        expect(prepared).toBe(expected);
        expect(prepared).toHaveLength(before.length);
        return processResult();
    });
    const [planned] = planRun(session, { stage: 'commit', only: ['github-actions/actionlint'] });
    const result = await BUILT_IN_CHECKS['github-actions/actionlint'].run(session, planned!);
    expect(result.status, JSON.stringify(result)).toBe('passed');
    expect(run).toHaveBeenCalledTimes(1);
    expect(await readFile(join(sandbox.path, '.github/workflows/caller.yml'), 'utf8')).toBe(before);
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
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(await pathExists(join(sandbox.path, '.git'))).toBe(false);
        if (note !== undefined) expect(result.note).toContain(note);
        expect(result.findings).toMatchObject(findings);
    },
);
