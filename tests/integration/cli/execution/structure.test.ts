import { join } from 'node:path';
import { renameSync } from 'node:fs';
import * as probes from '#cli/tools/probe.ts';
import { expect, spyOn, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { astGrepMatches } from '#cli/checks/structure/ast-grep.ts';
import { rejection } from '#tests/support/rejection.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await testdir();
    const files = Array.from(
        { length: 5000 },
        (_, index) => `scripts/long path with spaces/source-${String(index)}.sh`,
    );
    const received: string[] = [];
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-branches'] });
    const input = engineInput(session, planned!);
    const probe = spyOn(probes, 'probeTool').mockReturnValue({ name: 'ast-grep', state: 'ok', path: process.execPath });
    const processRun = spyOn(processes, 'run').mockImplementation(async (command) => {
        const batch = command.slice(5);
        received.push(...batch);
        return {
            code: 1,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(
                batch.map((file) => ({
                    file,
                    ruleId: 'bash-branches',
                    range: { start: { line: 0 }, end: { line: 1 } },
                })),
            ),
        };
    });
    try {
        const matches = await astGrepMatches(
            input,
            'packages/cli/configurations/language/bash/rules/bash-branches.yml',
            files,
        );
        expect(received).toStrictEqual(files);
        expect(matches?.map((match) => match.file)).toStrictEqual(files);
        expect(processRun.mock.calls.length).toBeGreaterThan(1);
    } finally {
        processRun.mockRestore();
        probe.mockRestore();
    }
});

test.each(['fatal exit', 'deadline', 'cancellation', 'malformed JSON', 'invalid match', 'unselected file'])(
    'ast-grep rejects %s and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
            'source.sh': 'echo example\n',
        });
        const session = await openSession(sandbox.path);
        const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-branches'] });
        const input = engineInput(session, planned!);
        const probe = spyOn(probes, 'probeTool').mockReturnValue({
            name: 'ast-grep',
            state: 'ok',
            path: process.execPath,
        });
        const output =
            failure === 'malformed JSON'
                ? '{'
                : JSON.stringify(
                      failure === 'invalid match'
                          ? [{ file: 'source.sh' }]
                          : failure === 'unselected file'
                            ? [
                                  {
                                      file: 'other.sh',
                                      ruleId: 'bash-branches',
                                      range: { start: { line: 0 }, end: { line: 1 } },
                                  },
                              ]
                            : [],
                  );
        const processRun = spyOn(processes, 'run').mockResolvedValue({
            code: failure === 'fatal exit' ? 2 : 0,
            missing: false,
            duration: 1,
            stdout: output,
            stderr: 'cannot read source.sh',
            isTimedOut: failure === 'deadline',
            isCanceled: failure === 'cancellation',
        });
        try {
            await rejection(
                astGrepMatches(input, 'packages/cli/configurations/language/bash/rules/bash-branches.yml', [
                    'source.sh',
                ]),
            );
            processRun.mockResolvedValue({ code: 0, missing: false, duration: 1, stdout: '[]', stderr: '' });
            expect(
                await astGrepMatches(input, 'packages/cli/configurations/language/bash/rules/bash-branches.yml', [
                    'source.sh',
                ]),
            ).toStrictEqual([]);
        } finally {
            processRun.mockRestore();
            probe.mockRestore();
        }
    },
);

test('folder checks count code files and preserve allowed and nested directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["typescript"]\n[structure]\nsingle_file_folder_allowed = [{ paths = ["allowed/**"], reason = "Required entry directory." }]\n',
        'lone/only.ts': '',
        'typed/one.ts': '',
        'typed/one.d.ts': '',
        'pair/first.ts': '',
        'pair/second.ts': '',
        'parent/main.ts': '',
        'parent/child/first.ts': '',
        'parent/child/second.ts': '',
        'dist/pkg/lone.ts': '',
        'allowed/only.ts': '',
    });
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder'],
    });
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
        'lone/only.ts',
        'typed/one.ts',
    ]);
});

test('prefix checks group files and directories once and honor allowances and the threshold', async () => {
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["typescript"]\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'cards/asset-card.ts': '',
        'cards/asset-list.ts': '',
        'cards/asset-row.ts': '',
        'cards/other.ts': '',
        'mixed/turn.ts': '',
        'mixed/turn-flow/first.ts': '',
        'mixed/turn-flow/second.ts': '',
        'fine/index.ts': '',
        'fine/index-page.ts': '',
        'fine/first.ts': '',
        'fine/second.ts': '',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/prefix-collisions'],
    };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]?.findings).toMatchObject([
        { file: 'cards/asset-card.ts', rule: 'shared-prefix' },
        { file: 'mixed/turn.ts', rule: 'shared-prefix' },
    ]);
    expect(initial.report.checks[0]?.findings).toHaveLength(2);
    const allowed =
        policy +
        '[structure]\nprefix_collision_allowed = [{ paths = ["cards/**"], reason = "Required public names." }]\n';
    await Bun.write(join(sandbox.path, 'gspot.toml'), allowed);
    const retained = await executeRun(await openSession(sandbox.path), options);
    expect(retained.report.checks[0]?.findings).toMatchObject([{ file: 'mixed/turn.ts' }]);
    expect(retained.report.checks[0]?.findings).toHaveLength(1);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        allowed + '[limits]\nprefix_collisions = { value = 3, reason = "Required grouping threshold." }\n',
    );
    const raised = await executeRun(await openSession(sandbox.path), options);
    expect(raised.report.exitCode).toBe(0);
});

test.each([
    ['javascript', 'js'],
    ['typescript', 'ts'],
    ['swift', 'swift'],
    ['python', 'py'],
    ['react', 'jsx'],
    ['nextjs', 'tsx'],
    ['react-native', 'tsx'],
    ['nestjs', 'ts'],
    ['express', 'js'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['fastapi', 'py'],
    ['xcode', 'swift'],
    ['xctest', 'swift'],
])('%s retains shared folder enforcement and observes corrections', async (configuration, extension) => {
    const language = { ts: 'typescript', tsx: 'typescript', swift: 'swift', py: 'python' }[extension] ?? 'javascript';
    const lone = `feature/only.${extension}`;
    const card = `cards/asset-card.${extension}`;
    const list = `cards/asset-list.${extension}`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "all"\nconfigurations = ["${configuration}", "${language}", "structure"]\n`,
        [lone]: '',
        [card]: '',
        [list]: '',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder', 'structure/prefix-collisions'],
    };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.exitCode).toBe(1);
    expect(initial.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'structure/single-file-folder', file: lone, line: 1, rule: 'lone-file' },
        { check: 'structure/prefix-collisions', file: card, line: 1, rule: 'shared-prefix' },
    ]);
    await Bun.write(join(sandbox.path, `feature/second.${extension}`), '');
    renameSync(join(sandbox.path, list), join(sandbox.path, `cards/other.${extension}`));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.checks).toHaveLength(2);
    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    expect(corrected.report.exitCode).toBe(0);
});

if (process.platform !== 'win32')
    test('prefix groups remain distinct when directory and prefix contain newlines', async () => {
        await using sandbox = await testdir();
        const paths = ['a\nb/c-one.ts', 'a\nb/c-two.ts', 'a/b\nc-one.ts', 'a/b\nc-two.ts'];
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["typescript"]\n',
            ...Object.fromEntries(paths.map((path) => [path, 'export const value = 1;\n'])),
        });
        commitAll(sandbox.path);
        const options = {
            stage: 'all' as const,
            skips: [],
            fix: false,
            isDryRun: false,
            noCache: true,
            only: ['structure/prefix-collisions'],
        };
        const initial = await executeRun(await openSession(sandbox.path), options);
        expect(initial.report.checks[0]!.findings.map((finding) => finding.file).sort()).toStrictEqual(
            [paths[0]!, paths[2]!].sort(),
        );
        renameSync(join(sandbox.path, paths[1]!), join(sandbox.path, 'a\nb/other.ts'));
        renameSync(join(sandbox.path, paths[3]!), join(sandbox.path, 'a/other.ts'));
        commitAll(sandbox.path);
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
    });
