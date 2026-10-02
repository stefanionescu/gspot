import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as inspections from '#cli/tools/inspect.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { astGrepMatches } from '#cli/checks/language/bash/ast-grep.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await testdir();
    const files = Array.from(
        { length: 5000 },
        (_, index) => `scripts/long path with spaces/source-${String(index)}.sh`,
    );
    const received: string[] = [];
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash'], '', 'all'),
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-limits'] });
    const input = engineInput(session, planned!);
    const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
        name: 'ast-grep',
        state: 'ok',
        path: process.execPath,
    });
    const processRun = spyOn(processes, 'run').mockImplementation((command) => {
        const batch = command.slice(5);
        received.push(...batch);
        return Promise.resolve({
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
        });
    });
    try {
        const matches = await astGrepMatches(input, 'kits/language/bash/rules/branches.yml', files);
        expect(received).toStrictEqual(files);
        expect(matches.map((match) => match.file)).toStrictEqual(files);
        expect(processRun.mock.calls.length).toBeGreaterThan(1);
    } finally {
        processRun.mockRestore();
        inspection.mockRestore();
    }
});

test.each(['fatal exit', 'malformed JSON', 'invalid match', 'unselected file'] as const)(
    'ast-grep rejects %s and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], '', 'all'),
            'source.sh': 'echo example\n',
        });
        const session = await openSession(sandbox.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-limits'] });
        const input = engineInput(session, planned!);
        const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
            name: 'ast-grep',
            state: 'ok',
            path: process.execPath,
        });
        const output = {
            'fatal exit': '[]',
            'malformed JSON': '{',
            'invalid match': JSON.stringify([{ file: 'source.sh' }]),
            'unselected file': JSON.stringify([
                { file: 'other.sh', ruleId: 'bash-branches', range: { start: { line: 0 }, end: { line: 1 } } },
            ]),
        }[failure];
        const processRun = spyOn(processes, 'run').mockResolvedValue({
            code: failure === 'fatal exit' ? 2 : 0,
            missing: false,
            duration: 1,
            stdout: output,
            stderr: 'cannot read source.sh',
        });
        try {
            await rejection(astGrepMatches(input, 'kits/language/bash/rules/branches.yml', ['source.sh']));
            processRun.mockResolvedValue({ code: 0, missing: false, duration: 1, stdout: '[]', stderr: '' });
            expect(await astGrepMatches(input, 'kits/language/bash/rules/branches.yml', ['source.sh'])).toStrictEqual(
                [],
            );
        } finally {
            processRun.mockRestore();
            inspection.mockRestore();
        }
    },
);
