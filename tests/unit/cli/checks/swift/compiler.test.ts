import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { buildPlan, prepareBuild } from '#cli/checks/language/swift/cache.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { matchFields, matchSubstring, captureRejection } from '#tests/setup/matchers.ts';
import { checkFindings, buildCheckInput, prepareSwiftInput, createCompilerCache } from '#tests/setup/check-input.ts';

test.each([
    { buildCode: 7, analyzerCode: 0, message: /build exited 7/u },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: /^The swiftlint command failed \(exit 7\): The tool printed no error output\.$/u,
    },
])(
    'analyzer: build exit $buildCode and analyzer exit $analyzerCode report the failed stage',
    async ({ buildCode, analyzerCode, message }) => {
        await using sandbox = await testdir();
        await using resources = new AsyncDisposableStack();
        const prepared = await prepareSwiftInput(sandbox, 'swift/swiftlint-analyze');
        resources.use(prepared.resources);
        resources.use(
            spyOn(processes, 'spawnProcess')
                .mockResolvedValueOnce(buildProcessResult({ code: buildCode }))
                .mockResolvedValue(buildProcessResult({ code: analyzerCode })),
        );
        expect(await captureRejection(CHECK_IMPLEMENTATIONS['swift/swiftlint-analyze'].check(prepared.input))).toMatch(
            message,
        );
    },
);

test('analyzer: manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await prepareSwiftInput(sandbox, 'swift/swiftlint-analyze');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    const compile = buildPlan(input);
    const analyzer = buildPlan(input, { purpose: 'analyze' });
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch!, 'state');
    await mkdir(join(compile.folder, 'package'), { recursive: true });
    await mkdir(analyzer.scratch!, { recursive: true });
    await writeFile(compilerState, 'incremental');
    await writeFile(analyzerState, 'old analyzer');
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'incremental log' }))
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'complete compiler log' }))
            .mockResolvedValue(buildProcessResult()),
    );

    expect(await CHECK_IMPLEMENTATIONS['swift/build'].check(input)).toStrictEqual([]);
    expect(await CHECK_IMPLEMENTATIONS['swift/swiftlint-analyze'].check(input)).toStrictEqual([]);
    expect(await readFile(compilerState, 'utf8')).toBe('incremental');
    expect(await isOnDisk(analyzerState)).toBe(false);
    expect(await readFile(analyzer.log, 'utf8')).toContain('complete compiler log');
    expect(await readFile(compile.log, 'utf8')).toContain('incremental log');
});
test('compiler: a failed Swift build without source diagnostics returns execution exit 2 and recovers', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await prepareSwiftInput(sandbox, 'swift/build', {
        'Main.swift': 'let value = 1\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
    });
    await using _preparation = prepared.resources;
    const options = buildRunOptions({ only: ['swift/build'] });
    const initial = prepared.session;
    const corrected = await openSession(sandbox.path);
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: 7, stdout: 'Compiler startup failed', stderr: 'Permission denied' }),
        ),
    );

    const failed = await runChecks(initial, options);
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toContainEqual(
        matchFields({
            check: 'swift/build',
            status: 'error',
            findings: [],
            note: matchSubstring('Permission denied'),
        }),
    );
    run.mockResolvedValue(buildProcessResult());
    const executed = await runChecks(corrected, options);
    expect(executed.report.exitCode).toBe(0);
});

test('compiler: a later Swift session reads a failed build after an earlier successful build', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await prepareSwiftInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const first = prepared.input;

    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(buildProcessResult())
            .mockResolvedValue(
                buildProcessResult({ code: 1, stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value` }),
            ),
    );

    expect(await CHECK_IMPLEMENTATIONS['swift/build'].check(first)).toStrictEqual([]);
    expect(await CHECK_IMPLEMENTATIONS['swift/build'].check(first)).toStrictEqual([]);
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([
        {
            check: 'swift/build',
            file: 'Main.swift',
            line: 4,
            column: 2,
            rule: 'compiler',
            message: 'Missing value',
            fixable: false,
            help: 'Fix the first compiler error; later ones often come from the same mistake.',
        },
    ]);
});

test('compiler: canceled Swift compilation refuses to launch the compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await prepareSwiftInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    input.cancelSignal = AbortSignal.abort();
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const compilation = await runChecks(
        prepared.session,
        buildRunOptions({ only: ['swift/build'], cancelSignal: input.cancelSignal }),
    );
    expect(compilation.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
    const analyzer = buildPlan(input, { purpose: 'analyze' });
    await mkdir(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    await writeFile(state, 'retained compiler state');
    const analysis = await runChecks(
        prepared.session,
        buildRunOptions({ only: ['swift/swiftlint-analyze'], cancelSignal: input.cancelSignal }),
    );
    expect(analysis.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: Swift response files stay inside the compiler cache before log publication', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    const prepared = await prepareSwiftInput(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });
    await using _preparation = prepared.resources;
    const input = prepared.input;
    const plan = buildPlan(input);

    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ stdout: `swiftc @${join(sandbox.path, 'external-response')}` }),
        ),
    );

    expect(await captureRejection(CHECK_IMPLEMENTATIONS['swift/build'].check(input))).toContain(
        'is not a safe repository-relative path',
    );
    expect(await isOnDisk(plan.log)).toBe(false);
    const response = join(plan.folder, 'sources');
    await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
    run.mockResolvedValue(buildProcessResult({ stdout: `swiftc @${response}` }));
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(await readFile(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
});

test('compiler: a failed Swift source preparation releases its build claim before a later writer', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await using _cache = await createCompilerCache();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSettingsText(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'swift/build');
    const plan = buildPlan(input);
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    expect(await captureRejection(CHECK_IMPLEMENTATIONS['swift/build'].check(input))).toContain('ENOENT');
    expect(run).not.toHaveBeenCalled();
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(false);
    {
        await Bun.write(join(sandbox.path, 'Main.swift'), 'let value = 1\n');
        const prepared = prepareBuild(input, plan.folder);
        using next = prepared.files;
        expect(next.read('build.lock')).toBeDefined();
    }
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(false);
});

test('compiler: Swift compiler diagnostics drop the macOS /private prefix from source paths', async () => {
    await using sandbox = await testdir();
    const prepared = await prepareSwiftInput(sandbox, 'swift/build', { 'Main.swift': 'let value = 1\n' });
    await using _preparation = prepared.resources;
    const input = prepared.input;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({
                code: 1,
                // eslint-disable-next-line sonarjs/publicly-writable-directories -- The test compares compiler error text and never opens these paths.
                stderr: '/private/tmp/project/Main.swift:4:2: error: Missing value\n/tmp/project/Other.swift:5:3: error: Unknown name',
            }),
        ),
    );
    expect(await CHECK_IMPLEMENTATIONS['swift/build'].check(input)).toStrictEqual([
        matchFields({
            // eslint-disable-next-line sonarjs/publicly-writable-directories -- reason: This expected compiler path serves as parser text and creates no filesystem entry.
            file: '/tmp/project/Main.swift',
            line: 4,
            column: 2,
            rule: 'compiler',
            message: 'Missing value',
        }),

        matchFields({
            // eslint-disable-next-line sonarjs/publicly-writable-directories -- reason: This expected compiler path serves as parser text and creates no filesystem entry.
            file: '/tmp/project/Other.swift',
            line: 5,
            column: 3,
            rule: 'compiler',
            message: 'Unknown name',
        }),
    ]);
});
