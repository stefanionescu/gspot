import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import * as processes from '#cli/platform/spawn.ts';
import { astGrepMatches } from '#cli/structure/ast-grep.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await createSandbox({});
    const files = Array.from(
        { length: 5000 },
        (_, index) => `scripts/long path with spaces/source-${String(index)}.sh`,
    );
    const received: string[] = [];
    const search = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    const processRun = spyOn(processes, 'runBlocking').mockImplementation((command) => {
        const batch = command.slice(5);
        received.push(...batch);
        return {
            code: 1,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(batch.map((file) => ({ file }))),
        };
    });
    try {
        const matches = astGrepMatches(sandbox.path, 'presets/language/bash/rules/bash-branches.yml', files);
        expect(received).toEqual(files);
        expect(matches?.map((match) => match.file)).toEqual(files);
        expect(processRun.mock.calls.length).toBeGreaterThan(1);
    } finally {
        search.mockRestore();
        processRun.mockRestore();
    }
});

test('ast-grep rejects a failed scan even when stdout contains partial JSON', async () => {
    await using sandbox = await createSandbox({});
    const search = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    const processRun = spyOn(processes, 'runBlocking').mockReturnValue({
        code: 2,
        missing: false,
        duration: 1,
        stdout: '[]',
        stderr: 'cannot read source.sh',
    });
    try {
        expect(() =>
            astGrepMatches(sandbox.path, 'presets/language/bash/rules/bash-branches.yml', ['source.sh']),
        ).toThrow('cannot read source.sh');
    } finally {
        search.mockRestore();
        processRun.mockRestore();
    }
});

test('folder checks count code files and preserve allowed and nested directories', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml':
            'version = 1\npresets = ["typescript"]\n[structure]\nsingle_file_folder_allowed = [{ paths = ["allowed/**"], reason = "Required entry directory." }]\n',
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
        localSkips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
        only: ['structure/single-file-folder'],
    });
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toEqual([
        'lone/only.ts',
        'typed/one.ts',
    ]);
});

test('prefix checks group files and directories once and honor allowances and the threshold', async () => {
    const policy = 'version = 1\npresets = ["typescript"]\n';
    await using sandbox = await createSandbox({
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
        localSkips: [],
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
