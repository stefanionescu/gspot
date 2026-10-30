import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { CALLER_WORKFLOW } from '#tests/config/github-actions.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { writeProgramCommand, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

import {
    ACTIONLINT_EXITS,
    WORKFLOW_TEXT_CASES,
    OUTSIDE_GITHUB_ACTIONS,
} from '#tests/config/checks/infrastructure/github-actions.ts';

test('actionlint copies root actions and unchanged actions outside .github with workflow replacements', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        ...OUTSIDE_GITHUB_ACTIONS,
    });
    const session = await openSession(sandbox.path);
    using _pins = fakeToolExecutables(
        ['actionlint', 'shellcheck'].map((name) => getTool(session.configurationsByName.values(), name)),
    );
    using boundary = spyOn(processes, 'spawnProcess').mockImplementation(async (_command, options) => {
        expect(await readFile(join(options.cwd, 'action.yml'), 'utf8')).toContain('uses: ./actions/setup');
        expect(await readFile(join(options.cwd, 'actions/setup/action.yml'), 'utf8')).toBe(
            OUTSIDE_GITHUB_ACTIONS['actions/setup/action.yml'],
        );
        return buildProcessResult();
    });
    const planned = planChecks(session, buildRunOptions({ only: ['github-actions/actionlint'] }))[0]!;
    const result = await runCheckCode(buildCheckSession(session), planned, CHECK_CODE['github-actions/actionlint']);
    expect(result.findings).toStrictEqual([]);
    expect(boundary).toHaveBeenCalledTimes(1);
    for (const [path, source] of Object.entries(OUTSIDE_GITHUB_ACTIONS))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
});

test.each([...WORKFLOW_TEXT_CASES])(
    'actionlint prepares references without changing their offsets: $name',
    async ({ path, before, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml':
                'on: workflow_dispatch\njobs:\n  caller:\n    uses: ./.github/actions/setup\n',
            [path]: before,
        });
        const session = await openSession(sandbox.path);
        using _pins = fakeToolExecutables([
            getTool(session.configurationsByName.values(), 'actionlint'),
            getTool(session.configurationsByName.values(), 'shellcheck'),
        ]);
        using run = spyOn(processes, 'spawnProcess').mockImplementation(async (_command, options) => {
            const written = await readFile(join(options.cwd, path), 'utf8');
            expect(written).toBe(expected);
            return buildProcessResult();
        });
        const [planned] = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const result = await runCheckCode(
            buildCheckSession(session),
            planned!,
            planned!.check.generator_outputs === undefined
                ? CHECK_CODE[planned!.check.id]
                : { check: checkGeneratorOutputs },
        );
        expect(result.status, JSON.stringify(result)).toBe('passed');
        expect(run).toHaveBeenCalledTimes(1);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(before);
    },
);

test.each([...ACTIONLINT_EXITS])(
    'actionlint runs in a temporary copy that gspot removes after exit $code, and the workflow is unchanged',
    async ({ code, status, findings, note }) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = CALLER_WORKFLOW;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml': workflow,
        });
        await writeProgramCommand(
            sandbox.path,
            'actionlint',
            'fakes/tool',
            '--version-line',
            String(getTool(readConfigurations().values(), 'actionlint').version),
            '--record-cwd',
            record,
            ...(code === 0 ? [] : ['--line', '.github/workflows/caller.yml:4:11: located defect [workflow-call]']),
            '--exit',
            String(code),
        );
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        using _pins = fakeToolExecutables([getTool(session.configurationsByName.values(), 'shellcheck')]);
        const plans = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await runCheckCode(buildCheckSession(session), planned, CHECK_CODE['github-actions/actionlint']);
        expect(result.status, JSON.stringify(result)).toBe(status);
        const workspace = await readFile(record, 'utf8');
        expect(workspace).not.toBe(sandbox.path);
        expect(await isOnDisk(workspace)).toBe(false);
        expect(await readFile(join(sandbox.path, '.github/workflows/caller.yml'), 'utf8')).toBe(workflow);
        const attributes = await stat(join(sandbox.path, '.github/workflows/caller.yml'));
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(await isOnDisk(join(sandbox.path, '.git'))).toBe(false);
        expect(result.note?.replace(executable, '<actionlint>')).toBe(note);
        expect(result.findings).toMatchObject(findings);
    },
);
