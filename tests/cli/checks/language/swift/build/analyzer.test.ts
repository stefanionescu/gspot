import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { buildPlan } from '#cli/checks/language/swift/plan.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { buildFolder } from '#cli/checks/language/swift/cache.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { swiftBuild, swiftlintAnalyze } from '#cli/checks/language/swift/build.ts';
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildEngineInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await rejection(swiftlintAnalyze(input))).toMatch(/build exited 7/u);
    } finally {
        run.mockRestore();
    }
});

test('a silent successful SwiftLint analyzer returns no findings', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildEngineInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    resources.use(
        spyOn(spawn, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 }),
    );
    expect(await swiftlintAnalyze(input)).toStrictEqual([]);
});

test('a silent failed SwiftLint analyzer reports its exit code', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildEngineInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    resources.use(
        spyOn(spawn, 'run')
            .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
            .mockResolvedValue({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 }),
    );
    expect(await rejection(swiftlintAnalyze(input))).toContain('analyzer exited 7');
});

test.each(['build', 'analyzer'])('a timed-out Swift %s reports an error', async (step) => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildEngineInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run');
    if (step === 'analyzer')
        run.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    run.mockResolvedValue({ code: 1, stdout: '', stderr: '', missing: false, duration: 1, isTimedOut: true });
    try {
        expect(await rejection(swiftlintAnalyze(input))).toMatch(/ran past 600 seconds and was stopped/u);
    } finally {
        run.mockRestore();
    }
});

test('manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildEngineInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const compile = buildPlan(input);
    const analyzer = buildPlan(input, 'analyze');
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
        expect(await swiftlintAnalyze(input)).toStrictEqual([]);
        expect(readFileSync(compilerState, 'utf8')).toBe('incremental');
        expect(existsSync(analyzerState)).toBe(false);
        expect(readFileSync(analyzer.log, 'utf8')).toContain('complete compiler log');
        expect(readFileSync(compile.log, 'utf8')).toContain('incremental log');
    } finally {
        run.mockRestore();
    }
});
