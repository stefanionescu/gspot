import { join } from 'node:path';
import * as spawn from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { swiftAnalyze, swiftBuild } from '#cli/checks/swift/build.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { removeBuildFolders, swiftInput } from '#tests/support/cli/swift.ts';
import { rejection } from '#tests/support/rejection.ts';

afterEach(() => {
    removeBuildFolders();
});

test.each([0, 7])('a silent Swift build with exit %i retains its verdict', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        // A clean build reports nothing; a failed build without diagnostics is an error that names the exit code.
        const findings = code === 0 ? await swiftBuild(input) : undefined;
        const refusal = code === 0 ? undefined : (await rejection(swiftBuild(input))).message;
        const exited = expect.stringContaining(`The Swift build exited ${String(code)} without source diagnostics.`);
        expect(findings).toStrictEqual(code === 0 ? [] : undefined);
        expect(refusal).toStrictEqual(code === 0 ? undefined : exited);
    } finally {
        run.mockRestore();
    }
});

test('a failed Swift build without source diagnostics returns execution exit 2 and recovers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Main.swift': 'let value = 1\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
    });
    removeBuildFolders(sandbox.path);
    const options = {
        stage: 'all' as const,
        only: ['swift/build'],
        skips: [],
        noCache: true,
        fix: false,
        isDryRun: false,
    };
    const initial = await openSession(sandbox.path);
    const corrected = await openSession(sandbox.path);
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 7,
        stdout: 'Compiler startup failed',
        stderr: 'Permission denied',
        missing: false,
        duration: 1,
    });
    try {
        const failed = await executeRun(initial, options);
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks).toContainEqual(
            expect.objectContaining({
                check: 'swift/build',
                status: 'error',
                findings: [],
                note: expect.stringContaining('Permission denied'),
            }),
        );
        run.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
        expect((await executeRun(corrected, options)).report.exitCode).toBe(0);
        expect(readFileSync(join(sandbox.path, 'Main.swift'), 'utf8')).toBe('let value = 1\n');
    } finally {
        run.mockRestore();
    }
});

test('a later Swift session observes a failed build after an earlier successful build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const first = await swiftInput(sandbox.path, 'swift/build');
    const second = await swiftInput(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({
            code: 1,
            stdout: '',
            stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value`,
            missing: false,
            duration: 1,
        });
    try {
        expect(await swiftBuild(first)).toStrictEqual([]);
        expect(await swiftBuild(first)).toStrictEqual([]);
        expect(await swiftBuild(second)).toStrictEqual([
            {
                check: 'swift/build',
                file: 'Main.swift',
                line: 4,
                column: 2,
                rule: 'compiler',
                message: 'Missing value',
                fixable: false,
            },
        ]);
    } finally {
        run.mockRestore();
    }
});

test('Swift compiler diagnostics retain their source location on a failed build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: '/project/Main.swift:4:2: error: Missing value',
        missing: false,
        duration: 1,
    });
    try {
        expect(await swiftBuild(input)).toMatchObject([
            { file: '/project/Main.swift', line: 4, column: 2, message: 'Missing value' },
        ]);
    } finally {
        run.mockRestore();
    }
});

test('canceled Swift compilation refuses to launch the compiler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await swiftInput(sandbox.path, 'swift/build');
    input.cancelSignal = AbortSignal.abort();
    expect((await rejection(swiftBuild(input))).message).toBe('The command was canceled.');
    const analyzer = swiftBuildPlan(input, 'analyze');
    mkdirSync(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    writeFileSync(state, 'retained compiler state');
    expect((await rejection(swiftAnalyze(input))).message).toBe('The command was canceled.');
    expect(readFileSync(state, 'utf8')).toBe('retained compiler state');
});

test('Swift response files stay inside the compiler cache before log publication', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'external-response': 'external bytes must not enter a compiler log',
    });
    const input = await swiftInput(sandbox.path, 'swift/build');
    const plan = swiftBuildPlan(input);
    const corrected = await swiftInput(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 0,
        stdout: `swiftc @${join(sandbox.path, 'external-response')}`,
        stderr: '',
        missing: false,
        duration: 1,
    });
    try {
        await rejection(swiftBuild(input));
        expect(existsSync(plan.log)).toBe(false);
        const response = join(plan.folder, 'sources');
        writeFileSync(response, 'Sources/Main.swift\nSources/Owner.swift\n');
        run.mockResolvedValue({ code: 0, stdout: `swiftc @${response}`, stderr: '', missing: false, duration: 1 });
        expect(await swiftBuild(corrected)).toStrictEqual([]);
        expect(readFileSync(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
        expect(readFileSync(join(sandbox.path, 'external-response'), 'utf8')).toBe(
            'external bytes must not enter a compiler log',
        );
    } finally {
        run.mockRestore();
    }
});
