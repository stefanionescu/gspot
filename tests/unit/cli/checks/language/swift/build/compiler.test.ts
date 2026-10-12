import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { processResult } from '#tests/setup/processes.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { SWIFT_PACKAGE } from '#tests/config/swift/package.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { rejection, containing, textContaining } from '#tests/setup/matchers.ts';
import { buildPlan, openBuildCache } from '#cli/checks/language/swift/build-folder.ts';
import { checkFindings, buildCheckInput, swiftBuildInput, isolateCompilerCache } from '#tests/setup/check-input.ts';

test('a failed Swift build without source diagnostics returns execution exit 2 and recovers', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build', {
        'Main.swift': 'let value = 1\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
    });
    await using _preparation = prepared.resources;
    const options = buildRunOptions({ only: ['swift/build'] });
    const initial = prepared.session;
    const corrected = await openSession(sandbox.path);
    const run = resources.use(
        spyOn(processes, 'run').mockResolvedValue(
            processResult({ code: 7, stdout: 'Compiler startup failed', stderr: 'Permission denied' }),
        ),
    );

    const failed = await executeRun(initial, options);
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toContainEqual(
        containing({
            check: 'swift/build',
            status: 'error',
            findings: [],
            note: textContaining('Permission denied'),
        }),
    );
    run.mockResolvedValue(processResult());
    const executed = await executeRun(corrected, options);
    expect(executed.report.exitCode).toBe(0);
});

test('a later Swift session reads a failed build after an earlier successful build', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const first = prepared.input;

    resources.use(
        spyOn(processes, 'run')
            .mockResolvedValueOnce(processResult())
            .mockResolvedValue(
                processResult({ code: 1, stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value` }),
            ),
    );

    expect(await CHECK_FUNCTIONS['swift/build'](first)).toStrictEqual([]);
    expect(await CHECK_FUNCTIONS['swift/build'](first)).toStrictEqual([]);
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([
        {
            check: 'swift/build',
            file: 'Main.swift',
            line: 4,
            column: 2,
            rule: 'compiler',
            message: 'Missing value',
            fixable: false,
            help: 'Fix the first compiler error; later ones are often the same mistake.',
        },
    ]);
});

test('canceled Swift compilation refuses to launch the compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    input.cancelSignal = AbortSignal.abort();
    const run = resources.use(spyOn(processes, 'run'));
    expect(await rejection(CHECK_FUNCTIONS['swift/build'](input))).toBe('The command was canceled.');
    const analyzer = buildPlan(input, 'analyze');
    await mkdir(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    await writeFile(state, 'retained compiler state');
    expect(await rejection(CHECK_FUNCTIONS['swift/swiftlint-analyze'](input))).toBe('The command was canceled.');
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('Swift response files stay inside the compiler cache before log publication', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });
    await using _preparation = prepared.resources;
    const input = prepared.input;
    const plan = buildPlan(input);

    const run = resources.use(
        spyOn(processes, 'run').mockResolvedValue(
            processResult({ stdout: `swiftc @${join(sandbox.path, 'external-response')}` }),
        ),
    );

    expect(await rejection(CHECK_FUNCTIONS['swift/build'](input))).toContain('is not a safe repository-relative path');
    expect(await pathExists(plan.log)).toBe(false);
    const response = join(plan.folder, 'sources');
    await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
    run.mockResolvedValue(processResult({ stdout: `swiftc @${response}` }));
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(await readFile(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
});

test('a failed Swift source preparation releases its build claim before a later writer', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await using _cache = await isolateCompilerCache();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': settingsText(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'swift/build');
    const plan = buildPlan(input);
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(spyOn(processes, 'run'));
    expect(await rejection(CHECK_FUNCTIONS['swift/build'](input))).toContain('ENOENT');
    expect(run).not.toHaveBeenCalled();
    expect(await pathExists(join(plan.folder, 'build.lock'))).toBe(false);
    {
        using next = openBuildCache(plan.folder);
        expect(next.read('build.lock')).toBeDefined();
    }
    expect(await pathExists(join(plan.folder, 'build.lock'))).toBe(false);
});

test('Swift compiler diagnostics drop the macOS /private prefix from source paths', async () => {
    await using sandbox = await testdir();
    const prepared = await swiftBuildInput(sandbox, 'swift/build', { 'Main.swift': 'let value = 1\n' });
    await using _preparation = prepared.resources;
    const input = prepared.input;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockResolvedValue(
            processResult({
                code: 1,
                // eslint-disable-next-line sonarjs/publicly-writable-directories -- The test compares compiler diagnostic text and never opens these paths.
                stderr: '/private/tmp/project/Main.swift:4:2: error: Missing value\n/tmp/project/Other.swift:5:3: error: Unknown name',
            }),
        ),
    );
    expect(await CHECK_FUNCTIONS['swift/build'](input)).toStrictEqual([
        // eslint-disable-next-line sonarjs/publicly-writable-directories -- The test compares this diagnostic path and never opens it.
        containing({ file: '/tmp/project/Main.swift', line: 4, column: 2, rule: 'compiler', message: 'Missing value' }),
        // eslint-disable-next-line sonarjs/publicly-writable-directories -- The test compares this diagnostic path and never opens it.
        containing({ file: '/tmp/project/Other.swift', line: 5, column: 3, rule: 'compiler', message: 'Unknown name' }),
    ]);
});
