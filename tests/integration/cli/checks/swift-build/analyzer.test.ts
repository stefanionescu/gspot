import { join } from 'node:path';
import * as spawn from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { swiftAnalyze, swiftBuild } from '#cli/checks/swift/build.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { removeBuildFolders, swiftInput } from '#tests/support/cli/swift.ts';
import { rejection } from '#tests/support/rejection.ts';

afterEach(() => {
    removeBuildFolders();
});

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect((await rejection(swiftAnalyze(input))).message).toMatch(/build exited 7/u);
    } finally {
        run.mockRestore();
    }
});

test.each([0, 7])('a silent SwiftLint analyzer with exit %i retains its verdict', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        // A clean analysis reports nothing; a failed one is an error that names the exit code.
        const findings = code === 0 ? await swiftAnalyze(input) : undefined;
        const refusal = code === 0 ? undefined : (await rejection(swiftAnalyze(input))).message;
        const exited = expect.stringContaining(`analyzer exited ${String(code)}`);
        expect(findings).toStrictEqual(code === 0 ? [] : undefined);
        expect(refusal).toStrictEqual(code === 0 ? undefined : exited);
    } finally {
        run.mockRestore();
    }
});

test.each(['build', 'analyzer'])('a timed-out Swift %s reports an error', async (step) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run');
    if (step === 'analyzer')
        run.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    run.mockResolvedValue({ code: 1, stdout: '', stderr: '', missing: false, duration: 1, isTimedOut: true });
    try {
        expect((await rejection(swiftAnalyze(input))).message).toMatch(/ran past 600 seconds and was stopped/u);
    } finally {
        run.mockRestore();
    }
});

test('manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/swiftlint-analyze');
    const compile = swiftBuildPlan(input);
    const analyzer = swiftBuildPlan(input, 'analyze');
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch!, 'state');
    mkdirSync(join(compile.folder, 'package'), { recursive: true });
    mkdirSync(analyzer.scratch!, { recursive: true });
    writeFileSync(compilerState, 'incremental');
    writeFileSync(analyzerState, 'old analyzer');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: 'incremental log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValueOnce({ code: 0, stdout: 'complete compiler log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await swiftBuild(input)).toStrictEqual([]);
        expect(await swiftAnalyze(input)).toStrictEqual([]);
        expect(readFileSync(compilerState, 'utf8')).toBe('incremental');
        expect(existsSync(analyzerState)).toBe(false);
        expect(readFileSync(analyzer.log, 'utf8')).toContain('complete compiler log');
        expect(readFileSync(compile.log, 'utf8')).toContain('incremental log');
    } finally {
        run.mockRestore();
    }
});
