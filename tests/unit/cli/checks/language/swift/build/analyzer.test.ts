import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { processResult } from '#tests/setup/processes.ts';
import { swiftBuildInput } from '#tests/setup/check-input.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CHECK_FUNCTIONS } from '#cli/checks/implementations.ts';
import { buildPlan } from '#cli/checks/language/swift/build-folder.ts';

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/swiftlint-analyze');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(processResult({ code: 7 }))
            .mockResolvedValue(processResult()),
    );

    expect(await rejection(CHECK_FUNCTIONS['swift/swiftlint-analyze'](input))).toMatch(/build exited 7/u);
});

test('a silent failed SwiftLint analyzer reports its exit code', async () => {
    await using sandbox = await testdir();

    using resources = new DisposableStack();

    const prepared = await swiftBuildInput(sandbox, 'swift/swiftlint-analyze');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(processResult())
            .mockResolvedValue(processResult({ code: 7 })),
    );
    expect(await rejection(CHECK_FUNCTIONS['swift/swiftlint-analyze'](input))).toBe(
        'The swiftlint command failed (exit 7): The tool printed no diagnostic.',
    );
});

test('manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/swiftlint-analyze');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    const compile = buildPlan(input);
    const analyzer = buildPlan(input, 'analyze');
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch!, 'state');
    await mkdir(join(compile.folder, 'package'), { recursive: true });
    await mkdir(analyzer.scratch!, { recursive: true });
    await writeFile(compilerState, 'incremental');
    await writeFile(analyzerState, 'old analyzer');
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(processResult({ stdout: 'incremental log' }))
            .mockResolvedValueOnce(processResult({ stdout: 'complete compiler log' }))
            .mockResolvedValue(processResult()),
    );

    expect(await CHECK_FUNCTIONS['swift/build'](input)).toStrictEqual([]);
    expect(await CHECK_FUNCTIONS['swift/swiftlint-analyze'](input)).toStrictEqual([]);
    expect(await readFile(compilerState, 'utf8')).toBe('incremental');
    expect(await pathExists(analyzerState)).toBe(false);
    expect(await readFile(analyzer.log, 'utf8')).toContain('complete compiler log');
    expect(await readFile(compile.log, 'utf8')).toContain('incremental log');
});
