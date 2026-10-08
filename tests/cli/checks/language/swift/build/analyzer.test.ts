import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { buildPlan } from '#cli/checks/language/swift/public.ts';
import { useCacheDirectory } from '#tests/harness/environment.ts';
import { SWIFT_PACKAGE } from '#tests/config/samples/swift/source.ts';
import { configurationManifests } from '#cli/configurations/public.ts';

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, { 'Package.swift': SWIFT_PACKAGE, 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await rejection(BUILT_IN_CHECKS['swift/swiftlint-analyze'].input(input))).toMatch(/build exited 7/u);
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
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, { 'Package.swift': SWIFT_PACKAGE, 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    resources.use(
        spyOn(spawn, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 }),
    );
    expect(await BUILT_IN_CHECKS['swift/swiftlint-analyze'].input(input)).toStrictEqual([]);
});

test('a silent failed SwiftLint analyzer reports its exit code', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, { 'Package.swift': SWIFT_PACKAGE, 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    resources.use(
        spyOn(spawn, 'run')
            .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
            .mockResolvedValue({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 }),
    );
    expect(await rejection(BUILT_IN_CHECKS['swift/swiftlint-analyze'].input(input))).toContain('analyzer exited 7');
});

test.each(['build', 'analyzer'])('a timed-out Swift %s reports an error', async (step) => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, { 'Package.swift': SWIFT_PACKAGE, 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run');
    if (step === 'analyzer')
        run.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    run.mockResolvedValue({ code: 1, stdout: '', stderr: '', missing: false, duration: 1, isTimedOut: true });
    try {
        expect(await rejection(BUILT_IN_CHECKS['swift/swiftlint-analyze'].input(input))).toMatch(
            /ran past 600 seconds and was stopped/u,
        );
    } finally {
        run.mockRestore();
    }
});

test('manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, { 'Package.swift': SWIFT_PACKAGE, 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/swiftlint-analyze');
    const compile = buildPlan(input);
    const analyzer = buildPlan(input, 'analyze');
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch!, 'state');
    await mkdir(join(compile.folder, 'package'), { recursive: true });
    await mkdir(analyzer.scratch!, { recursive: true });
    await writeFile(compilerState, 'incremental');
    await writeFile(analyzerState, 'old analyzer');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: 'incremental log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValueOnce({ code: 0, stdout: 'complete compiler log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await BUILT_IN_CHECKS['swift/build'].input(input)).toStrictEqual([]);
        expect(await BUILT_IN_CHECKS['swift/swiftlint-analyze'].input(input)).toStrictEqual([]);
        expect(await readFile(compilerState, 'utf8')).toBe('incremental');
        expect(await pathExists(analyzerState)).toBe(false);
        expect(await readFile(analyzer.log, 'utf8')).toContain('complete compiler log');
        expect(await readFile(compile.log, 'utf8')).toContain('incremental log');
    } finally {
        run.mockRestore();
    }
});
