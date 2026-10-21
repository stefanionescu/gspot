import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { runCheckImplementation } from '#cli/runs/check-run.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { selectCheckImplementation } from '#cli/checks/implementations.ts';
import { ACTIONLINT_EXITS, WORKFLOW_TEXT_CASES } from '#tests/data/checks/github-actions.ts';

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
            getToolDeclaration(session.manifests.values(), 'actionlint'),
            getToolDeclaration(session.manifests.values(), 'shellcheck'),
        ]);
        using run = spyOn(processes, 'spawnProcess').mockImplementation(async (_command, options) => {
            const prepared = await readFile(join(options.cwd, path), 'utf8');
            expect(prepared).toBe(expected);
            expect(prepared).toHaveLength(before.length);
            return buildProcessResult();
        });
        const [planned] = planRun(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const result = await runCheckImplementation(session, planned!, selectCheckImplementation(planned!.check));
        expect(result.status, JSON.stringify(result)).toBe('passed');
        expect(run).toHaveBeenCalledTimes(1);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(before);
    },
);

test.each([...ACTIONLINT_EXITS])(
    'actionlint runs in a scratch copy that is removed after exit $code, and the workflow is unchanged',
    async ({ code, status, findings, note }) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['github-actions']),
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        });
        await chmod(executable, 0o755);
        await chmod(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        using _pins = fakePinnedExecutables([getToolDeclaration(session.manifests.values(), 'shellcheck')]);
        const plans = planRun(session, { stage: 'commit', only: ['github-actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await runCheckImplementation(session, planned, selectCheckImplementation(planned.check));
        expect(result.status, JSON.stringify(result)).toBe(status);
        const workspace = await readFile(record, 'utf8');
        expect(workspace).not.toBe(sandbox.path);
        expect(await isOnDisk(workspace)).toBe(false);
        expect(await readFile(join(sandbox.path, '.github/workflows/caller.yml'), 'utf8')).toBe(workflow);
        const attributes = await stat(join(sandbox.path, '.github/workflows/caller.yml'));
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(await isOnDisk(join(sandbox.path, '.git'))).toBe(false);
        if (note !== undefined) expect(result.note).toContain(note);
        expect(result.findings).toMatchObject(findings);
    },
);
