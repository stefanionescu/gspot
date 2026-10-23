import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { writeScriptCommand, fakePinnedExecutables } from '#tests/setup/system/fakes.ts';
import { ACTIONLINT_EXITS, WORKFLOW_TEXT_CASES } from '#tests/config/checks/infrastructure/github-actions.ts';

test.each([...WORKFLOW_TEXT_CASES])(
    'actionlint prepares $path references without changing their offsets',
    async ({ path, before, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml':
                'on: workflow_dispatch\njobs:\n  caller:\n    uses: ./.github/actions/setup\n',
            [path]: before,
        });
        const session = await openSession(sandbox.path);
        using _pins = fakePinnedExecutables([
            getTool(session.configurations.values(), 'actionlint'),
            getTool(session.configurations.values(), 'shellcheck'),
        ]);
        using run = spyOn(processes, 'spawnProcess').mockImplementation(async (_command, options) => {
            const prepared = await readFile(join(options.cwd, path), 'utf8');
            expect(prepared).toBe(expected);
            expect(prepared).toHaveLength(before.length);
            return buildProcessResult();
        });
        const [planned] = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const result = await runCheckCode(session, planned!, findCheckCode(planned!.check));
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
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml': workflow,
        });
        await writeScriptCommand(
            sandbox.path,
            'actionlint',
            `if (process.argv.includes('--version')) console.log(${JSON.stringify(getTool(readConfigurations().values(), 'actionlint').version)}); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        );
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        using _pins = fakePinnedExecutables([getTool(session.configurations.values(), 'shellcheck')]);
        const plans = planChecks(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await runCheckCode(session, planned, findCheckCode(planned.check));
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
