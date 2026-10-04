import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as inspections from '#cli/tools/inspect.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { bashLimits } from '#cli/checks/language/bash/limits.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await testdir();
    const files = Array.from(
        { length: 5000 },
        (_, index) => `scripts/long path with spaces/source-${String(index)}.sh`,
    );
    const received: string[] = [];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nbranches = 1\nnesting = 100\nassignments = 100\n',
        }),
        ...Object.fromEntries(files.map((file) => [file, 'main() { echo example; }\n'])),
    });
    const session = await openSession(sandbox.path);
    const input = buildEngineInput(session, 'bash/limits');
    const selectedFiles = input.files.filter((file) => file.tags.includes(SCRIPT_TAG)).map((file) => file.path);
    const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
        name: 'ast-grep',
        state: 'ok',
        path: process.execPath,
    });
    const processRun = spyOn(processes, 'run').mockImplementation((command) => {
        const batch = command.slice(5);
        const isBranchQuery = command[4]?.endsWith('/branches.yml') === true;
        if (isBranchQuery) received.push(...batch);
        return Promise.resolve({
            code: 1,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify(
                (isBranchQuery ? batch : []).flatMap((file) => {
                    const match = {
                        file,
                        ruleId: 'bash-branches',
                        range: { start: { line: 0 }, end: { line: 1 } },
                    };
                    return [match, match];
                }),
            ),
        });
    });
    try {
        const outcome = await bashLimits(input);
        const findings = Array.isArray(outcome) ? outcome : outcome.findings;
        expect(received).toStrictEqual(selectedFiles);
        expect(received).toHaveLength(files.length);
        expect(findings.map((finding) => finding.file)).toStrictEqual(selectedFiles);
        expect(findings.every((finding) => finding.rule === 'branches')).toBe(true);
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
            'gspot.toml': buildPolicy(['bash'], {
                level: 'all',
                tables: '[limits.bash]\nbranches = 1\nnesting = 100\nassignments = 100\n',
            }),
            'source.sh': 'echo example\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildEngineInput(session, 'bash/limits');
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
            expect(await rejection(Promise.resolve(bashLimits(input)))).toContain(
                {
                    'fatal exit': 'cannot read source.sh',
                    'malformed JSON': 'JSON',
                    'invalid match': 'range',
                    'unselected file': 'unselected file: other.sh',
                }[failure],
            );
            processRun.mockResolvedValue({ code: 0, missing: false, duration: 1, stdout: '[]', stderr: '' });
            expect(await bashLimits(input)).toStrictEqual([]);
        } finally {
            processRun.mockRestore();
            inspection.mockRestore();
        }
    },
);
