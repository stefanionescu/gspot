import { existsSync } from 'node:fs';
import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { CHECK_CODE, selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/tools/pins.ts';
import {
    ACTIONLINT_EXITS,
    OUTSIDE_GITHUB_ACTIONS,
    WORKFLOW_TEXT_CASES,
} from '#tests/config/configurations/infrastructure.ts';
import { CALLER_WORKFLOW } from '#tests/config/setup/configurations.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions, CHECK_GENERATION, CHECK_RUN_OPTIONS } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeToolExecutables, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { readCallRecords } from '#tests/setup/system/programs.ts';

test('actionlint copies root actions and unchanged actions outside .github with workflow replacements', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        ...OUTSIDE_GITHUB_ACTIONS,
    });
    const session = await openSession(sandbox.path);
    using _pins = fakeToolExecutables(
        ['actionlint', 'shellcheck'].map((name) => getTool(readConfigurations().values(), name)),
    );
    using boundary = spyOn(processes, 'runProcess').mockImplementation(async (_command, options) => {
        expect(await readFile(join(options.cwd, 'action.yml'), 'utf8')).toContain('uses: ./actions/setup');
        expect(await readFile(join(options.cwd, 'actions/setup/action.yml'), 'utf8')).toBe(
            OUTSIDE_GITHUB_ACTIONS['actions/setup/action.yml'],
        );
        return buildProcessResult();
    });
    const planned = planChecks(session, buildRunOptions({ only: ['github-actions/actionlint'] }))[0]!;
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        CHECK_CODE['github-actions/actionlint'],
        CHECK_RUN_OPTIONS,
    );
    expect(result.findings).toStrictEqual([]);
    expect(boundary).toHaveBeenCalledTimes(1);
    for (const [path, source] of Object.entries(OUTSIDE_GITHUB_ACTIONS))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
});

test.each([...WORKFLOW_TEXT_CASES])(
    'actionlint prepares references without changing their offsets: $name',
    async ({ path, before, expected }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml':
                'on: workflow_dispatch\njobs:\n  caller:\n    uses: ./.github/actions/setup\n',
            [path]: before,
        });
        const session = await openSession(sandbox.path);
        using _pins = fakeToolExecutables([
            getTool(readConfigurations().values(), 'actionlint'),
            getTool(readConfigurations().values(), 'shellcheck'),
        ]);
        using run = spyOn(processes, 'runProcess').mockImplementation(async (_command, options) => {
            const written = await readFile(join(options.cwd, path), 'utf8');
            expect(written).toBe(expected);
            return buildProcessResult();
        });
        const [planned] = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const result = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            planned!,
            selectCheckCode(planned!.check),
            CHECK_RUN_OPTIONS,
        );
        expect(result.status, JSON.stringify(result)).toBe('passed');
        expect(run).toHaveBeenCalledTimes(1);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(before);
    },
);

test.each([...ACTIONLINT_EXITS])(
    'actionlint runs in a temporary copy that gspot removes after exit $code, and the workflow is unchanged',
    async ({ code, status, findings, note }) => {
        await using sandbox = await createGitSandbox({});
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = CALLER_WORKFLOW;
        const { version } = getTool(readConfigurations().values(), 'actionlint');
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml': workflow,
        });
        await writeProgramCommand(
            sandbox.path,
            'actionlint',
            'fakes/tool',
            '--version-line',
            String(version),
            '--record',
            record,
            ...(code === 0 ? [] : ['--line', '.github/workflows/caller.yml:4:11: located defect [workflow-call]']),
            '--exit',
            String(code),
        );
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'shellcheck')]);
        const plans = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            planned,
            CHECK_CODE['github-actions/actionlint'],
            CHECK_RUN_OPTIONS,
        );
        expect(result.status, JSON.stringify(result)).toBe(status);
        const [call] = await readCallRecords(record);
        const workspace = call?.cwd ?? '';
        expect(workspace).not.toBe(sandbox.path);
        expect(existsSync(workspace)).toBe(false);
        expect(await readFile(join(sandbox.path, '.github/workflows/caller.yml'), 'utf8')).toBe(workflow);
        const attributes = await stat(join(sandbox.path, '.github/workflows/caller.yml'));
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(result.note?.replace(executable, '<actionlint>')).toBe(note);
        expect(result.findings).toMatchObject(findings);
    },
);

test('workflow-shape reports each shape rule of a workflow, and passes after the fix', async () => {
    const path = '.github/workflows/check.yml';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        [path]: `on:
    pull_request: {}
jobs:
    test:
        runs-on: ubuntu-latest
        continue-on-error: true
        steps:
            - run: echo "\${{ matrix.suite }}"
            - uses: actions/upload-artifact@v4
`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'github-actions/workflow-shape');
    expect(findings.map(({ line, rule }) => [line, rule])).toStrictEqual([
        [1, 'pull-request-concurrency'],
        [4, 'job-timeout'],
        [5, 'latest-runner'],
        [6, 'continue-on-error'],
        [8, 'run-expression'],
        [9, 'artifact-retention'],
    ]);
    await writeFile(
        join(sandbox.path, path),
        `on:
    pull_request: {}
concurrency:
    group: \${{ github.ref }}
jobs:
    test:
        runs-on: ubuntu-24.04
        timeout-minutes: 30
        # The nightly compiler breaks without notice.
        continue-on-error: true
        steps:
            - run: echo "\${SUITE}"
              env:
                  SUITE: \${{ matrix.suite }}
            - uses: actions/upload-artifact@v4
              with:
                  retention-days: 7
`,
    );
    expect(await runSandboxCheck(sandbox.path, 'github-actions/workflow-shape')).toStrictEqual([]);
});

test('workflow-shape accepts a push-only workflow with a concurrency group', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['github-actions']),
        '.github/workflows/release.yml': 'on: push\nconcurrency:\n    group: release\njobs: {}\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'github-actions/workflow-shape')).toStrictEqual([]);
});
