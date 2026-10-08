import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as inspections from '#cli/tools/inspect.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as batches from '#cli/execution/command/batches.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { functionSize } from '#cli/checks/language/bash/function-size.ts';

test('ast-grep batches all file arguments and retains matches from every batch', async () => {
    await using sandbox = await testdir();
    const files = [
        'scripts/long path with spaces/first.sh',
        'scripts/long path with spaces/second.sh',
        'scripts/long path with spaces/third.sh',
    ];
    const received: string[] = [];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nbranches = 1\nnesting = 100\nassignments = 100\n',
        }),
        ...Object.fromEntries(files.map((file) => [file, 'main() { echo example; }\n'])),
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'bash/function-size');
    const selectedFiles = input.files.filter((file) => file.tags.includes(SCRIPT_TAG)).map((file) => file.path);
    using batching = spyOn(batches, 'fileBatches').mockImplementation((selected) => [
        selected.slice(0, 2),
        selected.slice(2),
    ]);
    using _inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
        name: 'ast-grep',
        state: 'ok',
        path: process.execPath,
    });
    using processRun = spyOn(processes, 'run').mockImplementation((command) => {
        const batch = command.slice(5);
        const isBranchQuery = basename(command[4] ?? '') === 'branches.yml';
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
    const findings = await functionSize(input);
    expect(received).toStrictEqual(selectedFiles);
    expect(received).toHaveLength(files.length);
    expect(findings.map((finding) => finding.file)).toStrictEqual(selectedFiles);
    expect(findings.every((finding) => finding.rule === 'branches')).toBe(true);
    expect(batching).toHaveBeenCalled();
    expect(processRun.mock.calls.length).toBeGreaterThan(1);
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
        const input = buildCheckInput(session, 'bash/function-size');
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
            expect(await rejection(Promise.resolve(functionSize(input)))).toContain(
                {
                    'fatal exit': 'cannot read source.sh',
                    'malformed JSON': 'JSON',
                    'invalid match': 'range',
                    'unselected file': 'unselected file: other.sh',
                }[failure],
            );
            processRun.mockResolvedValue({ code: 0, missing: false, duration: 1, stdout: '[]', stderr: '' });
            expect(await functionSize(input)).toStrictEqual([]);
        } finally {
            processRun.mockRestore();
            inspection.mockRestore();
        }
    },
);

test.each(['.sh', '.bats', ''])(
    'Bash %s heredocs and multiline strings keep their literal code lines',
    async (extension) => {
        const source = '#!/bin/sh\n# comment\ncat <<\'EOF\'\n# literal\nEOF\nvalue="first\n# literal\nlast"\n';
        const file = `run${extension}`;
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['bash'], { level: 'all', tables: '[limits.bash]\nfile_lines = 5\n' }),
            [file]: source,
        });
        const found = await fileLines(buildCheckInput(await openSession(sandbox.path), 'structure/file-lines'));
        expect(found).toMatchObject([
            { file, line: 1, rule: 'file-lines', message: 'This file has 6 code lines, over the ceiling of 5.' },
        ]);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
        await Bun.write(join(sandbox.path, file), source.replace('# literal\nEOF', 'EOF'));
        expect(await fileLines(buildCheckInput(await openSession(sandbox.path), 'structure/file-lines'))).toStrictEqual(
            [],
        );
    },
);
